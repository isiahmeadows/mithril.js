import * as V from "./internal/vnode"
import {
    SugaredAttributes, ComponentAttributes,
    desugarElementAttrs, RETAIN,
} from "./internal/hyperscript-common"
import {hasOwn, eachKey, merge, isEmpty} from "./internal/util"
import {TrustedString, TagNameString} from "./internal/dom"

export {create} from "./internal/vnode"

export type ParsedVnode =
    | {type: "hole"}
    | {type: "text", value: string}
    | {type: "fragment", children: V.Vnode[]}
    | {type: "retain"}
    | {
        type: "element"
        tagName: TagNameString
        attributes: APIOptional<V.ElementAttributesObject>
        children: V.Vnode[]
    }
    | {type: "state", body: V.StateInit<V.StateValue>}
    | {type: "link", identity: V.LinkValue, children: V.Vnode[]}
    | {type: "keyed", entries: Array<[V.KeyValue, V.Vnode]>}
    | {type: "static", child: V.Vnode}
    | {type: "trusted", value: TrustedString}
    | {
        type: "component"
        tagName: V.PolymorphicComponent
        attributes: V.ComponentAttributesObject
    }
    | {
        type: "portal"
        target: V.RefValue
        attributes: APIOptional<V.ElementAttributesObject>
        children: V.Vnode[]
    }
    | {type: "transition", options: V.TransitionOptions, child: V.VnodeElement}

export function parse(vnode: V.Vnode): ParsedVnode {
    if (vnode == null || typeof vnode === "boolean") {
        return {type: "hole"}
    }

    if (typeof vnode !== "object") {
        return {type: "text", value: String(vnode)}
    }

    if (Array.isArray(vnode)) {
        return {type: "fragment", children: vnode}
    }

    if (__DEV__) {
        const typeId = vnode[""]
        if (
            typeof typeId !== "number" ||
            // eslint-disable-next-line no-bitwise
            typeId !== (typeId | 0) ||
            typeId < V.TypeMeta.End
        ) {
            throw new Error(`Invalid vnode type: ${typeId}`)
        }
    }

    switch (vnode[""]) {
    case V.Type.Retain:
        return {type: "retain"}

    case V.Type.Element:
        return {
            type: "element",
            tagName: vnode._[0],
            attributes: vnode._[1],
            children: vnode._.slice(2) as V.Vnode[]
        }

    case V.Type.State:
        return {type: "state", body: vnode._}

    case V.Type.Link:
        return {
            type: "link",
            identity: vnode._[0],
            children: vnode._.slice(1) as V.Vnode[]
        }

    case V.Type.Keyed: {
        const entries = [] as Array<[V.KeyValue, V.Vnode]>
        for (let i = 0; i < vnode._.length; i += 2) {
            entries.push([
                vnode._[i] as V.KeyValue,
                vnode._[i + 1] as V.Vnode,
            ])
        }
        return {type: "keyed", entries}
    }

    case V.Type.Trust:
        return {type: "trusted", value: vnode._}

    case V.Type.Component:
        return {
            type: "component",
            tagName: vnode._[0],
            attributes: vnode._[1],
        }

    case V.Type.Portal:
        return {
            type: "portal",
            target: vnode._[0],
            attributes: vnode._[1],
            children: vnode._.slice(2) as V.Vnode[]
        }

    case V.Type.Transition:
        return {
            type: "transition",
            options: vnode._[1],
            child: vnode._[2],
        }

    default:
        if (__DEV__) throw new Error("impossible")
        return void 0 as never
    }
}

export function compile(vnode: ParsedVnode): V.Vnode {
    switch (vnode.type) {
    case "hole":
        return void 0

    case "text":
        return vnode.value

    case "fragment":
        return vnode.children

    case "retain":
        return RETAIN

    case "element": {
        const data = [vnode.tagName, vnode.attributes] as Array<
            | TagNameString
            | V.ElementAttributesObject
            | V.Vnode
        >
        for (let i = 0; i < vnode.children.length; i++) {
            data.push(vnode.children[i])
        }
        return V.create(V.Type.Element, data as V.VnodeElement["_"])
    }

    case "state":
        return V.create(V.Type.State, vnode.body)

    case "link": {
        const data = [vnode.identity] as Array<V.LinkValue | V.Vnode>
        for (let i = 0; i < vnode.children.length; i++) {
            data.push(vnode.children[i])
        }
        return V.create(V.Type.Link, data as V.VnodeElement["_"])
    }

    case "keyed": {
        const data = [] as Array<V.KeyValue | V.Vnode>
        for (let i = 0; i < vnode.entries.length; i++) {
            const entry = vnode.entries[i]
            data.push(entry[0], entry[1])
        }
        // TODO: check for duplicates
        return V.create(V.Type.Keyed, data)
    }

    case "trusted":
        return V.create(V.Type.Trust, vnode.value)

    case "component":
        return V.create(V.Type.Component, [vnode.tagName, vnode.attributes])

    case "portal": {
        const data = [vnode.target, vnode.attributes] as Array<
            | V.RefObject
            | V.ElementAttributesObject
            | V.Vnode
        >
        for (let i = 0; i < vnode.children.length; i++) {
            data.push(vnode.children[i])
        }
        return V.create(V.Type.Element, data as V.VnodeElement["_"])
    }

    case "transition":
        return V.create(V.Type.Transition, [void 0, vnode.options, vnode.child])

    default:
        if (__DEV__) {
            throw new TypeError(
                `Unknown vnode type: ${(vnode as {type: string}).type}`
            )
        }
        return void 0
    }
}

function invokeHandler(
    listener: V.EventListener<V.EventValue, V.RefObject>,
    event: V.EventValue,
    capture: V.Capture,
    ref: V.RefObject
): Await<void> {
    try {
        return typeof listener === "function"
            ? listener(event, capture, ref)
            // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
            // @ts-ignore https://github.com/microsoft/TypeScript/issues/35866
            : (0, listener[1])(
                // https://github.com/microsoft/TypeScript/issues/1863
                ref[listener[0] as string],
                capture, ref
            )
    } catch (e) {
        return Promise.reject(e as Any)
    }
}

// This could be called in perf-sensitive code, so it needs to be at least
// baseline-optimized.
export function augment(
    vnode: V.VnodeElement | V.VnodeComponent | V.VnodePortal,
    attrs: APIOptional<
        | V.ElementAttributesObject
        | SugaredAttributes
        | ComponentAttributes
        | V.Vnode
    >
): V.VnodeElement | V.VnodeComponent | V.VnodePortal {
    if (__DEV__) {
        if (
            vnode == null || typeof vnode !== "object" ||
            typeof vnode[""] !== "number" ||
            vnode[""] !== V.Type.Element &&
            vnode[""] !== V.Type.Component &&
            vnode[""] !== V.Type.Portal
        ) {
            throw new TypeError(
                "Only element, component, and portal elements can be augmented."
            )
        }
    }

    let start = 2

    if (isEmpty(attrs)) {
        // If it's empty, don't retain it.
        attrs = void 0
    } else if (
        typeof (attrs as Partial<V.VnodeNonPrimitive>)[""] === "number"
    ) {
        start = 1
        attrs = void 0
    }

    // Nothing to add - let's just skip it all.
    if (arguments.length === start && attrs == null) return vnode

    let newAttrs = vnode._[0] as V.ElementAttributesObject

    if (attrs != null) {
        const oldAttrs = vnode._[1]
        const inputAttrs = vnode[""] === V.Type.Component
            ? attrs as V.ElementAttributesObject
            : desugarElementAttrs(attrs as SugaredAttributes)

        if (oldAttrs == null) {
            newAttrs = inputAttrs
        } else {
            newAttrs = merge(oldAttrs, inputAttrs)

            if (
                hasOwn.call(inputAttrs, "on") && inputAttrs.on != null &&
                hasOwn.call(oldAttrs, "on") && oldAttrs.on != null
            ) {
                const newOn = newAttrs.on = merge(oldAttrs.on, inputAttrs.on)

                eachKey(oldAttrs.on, (oldHandler, key) => {
                    if (oldHandler == null) return
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const newHandler = inputAttrs.on![key]
                    if (newHandler == null) return

                    newOn[key] = (event, capture, ref) => {
                        const p = invokeHandler(oldHandler, event, capture, ref)
                        if (capture.eventCaptured()) return p
                        return Promise.all([
                            p,
                            invokeHandler(newHandler, event, capture, ref)
                        ]) as Any as Await<void>
                    }
                })
            }

            if (vnode[""] !== V.Type.Component) {
                if (
                    hasOwn.call(inputAttrs, "class") &&
                    inputAttrs.class != null &&
                    hasOwn.call(oldAttrs, "class") &&
                    oldAttrs.class != null
                ) {
                    newAttrs.class = `${
                        oldAttrs.class as string
                    } ${
                        newAttrs.class as string
                    }`
                }

                if (
                    hasOwn.call(inputAttrs, "style") &&
                    inputAttrs.style != null &&
                    hasOwn.call(oldAttrs, "style") &&
                    oldAttrs.style != null
                ) {
                    newAttrs.style = merge(oldAttrs.style, inputAttrs.style)
                }
            }
        }
    }

    const newData = vnode._.slice() as Array<
        | TagNameString
        | V.PolymorphicComponent
        | V.ElementAttributesObject
        | V.ComponentAttributesObject
        | V.Vnode
    >

    newData[1] = newAttrs

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    while (start < arguments.length) newData.push(arguments[start++])

    return V.create(
        vnode[""],
        newData as (V.VnodeElement | V.VnodeComponent | V.VnodePortal)["_"],
    )
}
