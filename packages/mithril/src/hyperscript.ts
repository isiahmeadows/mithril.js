import * as V from "./internal/vnode"
import {arrayify, isEmpty, assertDevelopment} from "./internal/util"
import {TrustedString, TagNameString} from "./internal/dom"
import {
    SugaredAttributes, ComponentAttributes, Component,
    desugarElementAttrs, RETAIN,
} from "./internal/hyperscript-common"

// Display precisely where the error is in the dev build - this will take a
// lot more space and is why the separate dev build exists - it's all for
// the dev side.
function invalidSelector(
    selector: string, pos: number, message: string
): never {
    assertDevelopment()
    let str = `Error at offset ${pos}\n\n"${selector}"\n`
    for (let i = 0; i <= pos; i++) str += " "
    throw new SyntaxError(`${str}^\n\n${message}`)
}

function validateTagName(tag: string): void {
    assertDevelopment()

    let index: number

    if (tag === "" || tag.startsWith(".")) {
        return invalidSelector(
            tag, 0, "String selectors must include tag names."
        )
    }

    if (tag.startsWith("#")) {
        return invalidSelector(tag, 0, "Unknown special tag.")
    }

    if ((index = tag.indexOf(" ")) >= 0) {
        return invalidSelector(
            tag, index, "String selectors must not contain spaces."
        )
    }

    if (
        (index = tag.indexOf("..")) >= 0 ||
            tag[index = tag.length - 1] === "."
    ) {
        return invalidSelector(
            tag, index, "String selectors must not contain empty class names."
        )
    }
}

function Fragment() {
    throw new TypeError("This component is not meant to be invoked directly.")
}

interface IfElseBlocks {
    then(): V.Vnode
    else(): V.Vnode
}

type _KeyFrom<T extends Polymorphic> =
    {[P in keyof T]: T[P] extends V.KeyValue ? P : never}[keyof T]

type _KeySelector<T extends Polymorphic> =
    (value: T, index: number) => V.KeyValue

interface Hyperscript {
    (tag: typeof Fragment, ...children: V.Vnode[]): V.VnodeElement
    (
        tag: typeof Fragment, attrs: SugaredAttributes, ...children: V.Vnode[]
    ): V.VnodeElement
    (tag: string, ...children: V.Vnode[]): V.VnodeElement
    (
        tag: string, attrs: SugaredAttributes, ...children: V.Vnode[]
    ): V.VnodeElement
    (tag: Component, ...children: V.Vnode[]): V.VnodeComponent
    (
        tag: Component, attrs: ComponentAttributes, ...children: V.Vnode[]
    ): V.VnodeComponent
    (tag: V.RefValue, ...children: V.Vnode[]): V.VnodePortal
    (
        tag: V.RefValue, attrs: ComponentAttributes, ...children: V.Vnode[]
    ): V.VnodePortal

    jsx(
        tag: typeof Fragment,
        attrs: APIOptional<never>,
        ...children: V.Vnode[]
    ): V.VnodeFragment
    jsx(
        tag: TagNameString,
        attrs: APIOptional<SugaredAttributes>,
        ...children: V.Vnode[]
    ): V.VnodeElement
    jsx(
        tag: Component,
        attrs: APIOptional<ComponentAttributes>,
        ...children: V.Vnode[]
    ): V.VnodeComponent
    jsx(
        tag: V.RefValue,
        attrs: APIOptional<SugaredAttributes>,
        ...children: V.Vnode[]
    ): V.VnodePortal

    RETAIN: V.VnodeRetain
    link(id: V.LinkValue, ...children: V.Vnode[]): V.VnodeLink
    state(initializer: V.StateInit<V.StateValue>): V.VnodeState
    trust(text: Any): V.VnodeTrust
    if(cond: boolean, blocks: IfElseBlocks): V.VnodeLink
    each<T extends Polymorphic>(
        coll: Iterable<T>,
        keySelector: _KeyFrom<T> | _KeySelector<T>,
        view: (value: T, index: number) => V.Vnode
    ): V.VnodeLink
    Fragment: Component
    transition(
        options: V.TransitionOptions,
        child: V.VnodeElement
    ): V.VnodeTransition
}

function compilePropertySelector<T extends Polymorphic>(
    keySelector: _KeyFrom<T>
): _KeySelector<T> {
    const key = typeof keySelector === "symbol"
        ? keySelector
        // Coercion to a string is just so it's not done repeatedly in the
        // callback
        : `${keySelector}` as _KeyFrom<T>
    // Have to cast to `Polymorphic` because it can't understand that symbols
    // are valid keys (and thus infer the return type correctly)
    return (value: T) => value[key] as Polymorphic as V.KeyValue
}

export {m as default}
const m: Hyperscript = /*@__PURE__*/ (() => {
function m(
    tag: typeof Fragment | string | Component | V.RefValue,
    attrs: APIOptional<
        | V.ElementAttributesObject
        | SugaredAttributes
        | ComponentAttributes
        | V.Vnode
    >
): V.Vnode {
    let start = 2

    if (isEmpty(attrs)) {
        // If it's empty, don't retain it.
        attrs = void 0
    } else if (
        typeof (attrs as Partial<V.VnodeNonPrimitive>)["%"] === "number"
    ) {
        start = 1
        attrs = void 0
    }

    if (tag === m.Fragment) {
        return arrayify.apply<number, V.Vnode[]>(start, arguments)
    }

    if (typeof tag !== "function") {
        // If in release mode, defer the check to the runtime - it'll
        // validate and throw as necessary.
        if (__DEV__) {
            if (typeof tag === "string") {
                validateTagName(tag)
            } else if (tag != null && typeof tag !== "object") {
                throw new TypeError(
                    "The selector must be either a string or a component."
                )
            }
        }

        if (attrs != null) {
            attrs = desugarElementAttrs(attrs as SugaredAttributes)
        }
    }

    const data: Any[] = [tag, attrs]
    while (start < arguments.length) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        data.push(arguments[start++])
    }

    return V.create(
        typeof tag === "string" ? V.Type.Element
            : typeof tag === "function" ? V.Type.Component
                : V.Type.Portal,
        data as (V.VnodeElement | V.VnodeComponent | V.VnodePortal)["_"]
    )
}

m.jsx = function (
    tag: typeof Fragment | TagNameString | Component | V.RefValue,
    attrs: APIOptional<SugaredAttributes | ComponentAttributes>
): V.Vnode {
    if (tag === Fragment) {
        return arrayify.apply<number, V.Vnode[]>(2, arguments)
    }

    const data = arrayify.apply(0, arguments) as (
        (V.VnodeElement | V.VnodeComponent | V.VnodePortal)["_"]
    )

    if (isEmpty(attrs)) attrs = data[1] = void 0

    if (typeof tag !== "function") {
        // If in release mode, defer the check to the runtime - it'll
        // validate and throw as necessary.
        if (__DEV__) {
            if (typeof tag === "string") {
                validateTagName(tag)
            } else if (tag != null && typeof tag !== "object") {
                throw new TypeError(
                    "The selector must be either a string or a component."
                )
            }
        }

        if (attrs != null) {
            data[1] = desugarElementAttrs(attrs as SugaredAttributes)
        }
    }

    return V.create(
        typeof tag === "string" ? V.Type.Element
            : typeof tag === "function" ? V.Type.Component
                : V.Type.Portal,
        data,
    )
}

m.RETAIN = RETAIN

m.link = function () {
    return V.create(
        V.Type.Link,
        arrayify.apply(0, arguments) as V.VnodeLink["_"]
    )
}

m.state = (init: V.StateInit<V.StateValue>): V.VnodeState =>
    V.create(V.Type.State, init)

m.trust = (text: Exclude<Any, symbol>): V.VnodeTrust =>
    // Extremely unsafe typing: we're taking an arbitrary value and turning it
    // into a trusted string. This also falls in line with the risks the user is
    // taking by using this.
    V.create(V.Type.Trust, String(text) as Any as TrustedString)

m.if = (cond: boolean, blocks: IfElseBlocks): V.Vnode => {
    cond = !!cond
    const block = cond ? blocks.then : blocks.else
    return block == null ? null : V.create(V.Type.Link, [
        cond as Any as V.LinkValue,
        block.call(blocks)
    ])
}

m.each = <T extends Polymorphic>(
    // The redundancy here is just for the guard to work.
    coll: T[] | Iterable<T>,
    keySelector: _KeyFrom<T> | _KeySelector<T>,
    view: (value: T, index: number) => V.Vnode
) => {
    if (typeof keySelector !== "function") {
        keySelector = compilePropertySelector(keySelector)
    }

    const data = [] as Array<V.Vnode | V.KeyValue>

    // Fast-path arrays - we can iterate those very easily.
    if (Array.isArray(coll)) {
        for (let i = 0, len = coll.length; i < len; i++) {
            const item = coll[i]
            const child = view(item, i)
            if (child != null && typeof child !== "boolean") {
                data.push(keySelector(item, i), child)
            }
        }
    } else {
        const iter = coll[Symbol.iterator]()

        try {
            for (let i = 0; ; i++) {
                const next = iter.next()
                if (next.done) break
                const item = next.value
                const child = view(item, i)
                if (child != null && typeof child !== "boolean") {
                    data.push(keySelector(item, i), child)
                }
            }
        } catch (e) {
            try {
                if (typeof iter.return === "function") iter.return()
            } finally {
                // eslint-disable-next-line no-unsafe-finally
                throw e
            }
        }
    }

    return V.create(V.Type.Keyed, data)
}

m.transition = (
    options: V.TransitionOptions,
    child: V.VnodeElement
): V.VnodeTransition =>
    V.create(V.Type.Transition, [options, child])

// This should always align with the hyperscript version they're plugged into -
// it's not supported to use such tags from other instances.
m.Fragment = Fragment

return m as Hyperscript
})()
