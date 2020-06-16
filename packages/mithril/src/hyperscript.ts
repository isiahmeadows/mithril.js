// Note: everything here is performance-sensitive. It's almost as perf-sensitive
// as the renderer.

import * as V from "./internal/vnode"
import {isEmpty, assertDevelopment, assign} from "./internal/util"
import {TrustedString, TagNameString} from "./internal/dom"
import {
    SugaredAttributes, ComponentAttributes,
    desugarElementAttrs, RETAIN,
} from "./internal/hyperscript-common"
import * as KeySet from "./internal/key-set"

// Using an explicit prototype because I need to control the emit
function createFragmentFromArguments(
    this: number,
    ...args: Any[]
): V.VnodeFragment
function createFragmentFromArguments(this: number): V.VnodeFragment {
    const result = [] as Any[]
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    for (let i = this; i < arguments.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        result.push(arguments[i])
    }
    return result as V.Vnode[]
}

// This avoids a diff for an exceedingly common case. Note that this is
// *extremely* perf-sensitive, and might have the array check removed if that
// proves too slow.
function isTriviallyEmpty(
    this: number,
    ...args: Any[]
): boolean
function isTriviallyEmpty(this: number) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    for (let i = this; i < arguments.length; i++) {
        const arg = arguments[i] as Polymorphic
        if (
            arg != null && arg !== "" && typeof arg !== "boolean" &&
            !(Array.isArray(arg) && arg.length === 0)
        ) {
            return false
        }
    }

    return true
}

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

function makeProxy<T extends V.VnodeNonPrimitive>(
    this: T[""], first: Any
): Maybe<T> {
    if (isTriviallyEmpty.apply(1, arguments)) return void 0
    const data = [] as Any[]
    data.push(first)
    data.push.apply(data, arguments)
    data[1] = void 0
    return V.create(this, data as T["_"])
}

// Built-in component implemented as a failsafe. 99.99% of the time this is
// fast-pathed, so the actual body is unlikely to ever be invoked in most apps.
function Fragment(attrs: V.ComponentAttributesObject): V.Vnode {
    return attrs.children as V.VnodeFragment
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
    (tag: V.PolymorphicComponent, ...children: V.Vnode[]): V.VnodeComponent
    (
        tag: V.PolymorphicComponent, attrs: ComponentAttributes,
        ...children: V.Vnode[]
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
        tag: V.PolymorphicComponent,
        attrs: APIOptional<ComponentAttributes>,
        ...children: V.Vnode[]
    ): V.VnodeComponent
    jsx(
        tag: V.RefValue,
        attrs: APIOptional<SugaredAttributes>,
        ...children: V.Vnode[]
    ): V.VnodePortal

    RETAIN: V.VnodeRetain
    link(id: V.LinkValue, ...children: V.Vnode[]): V.Vnode
    state(initializer: V.StateInit<V.StateValue>): V.Vnode
    trust(text: Any): V.Vnode
    if(cond: boolean, blocks: IfElseBlocks): V.Vnode
    each<T extends Polymorphic>(
        coll: Iterable<T>,
        keySelector: _KeyFrom<T> | _KeySelector<T>,
        view: (value: T, index: number) => V.Vnode
    ): V.Vnode
    Fragment: V.PolymorphicComponent
    transition(
        options: V.TransitionOptions,
        child: V.VnodeElement
    ): V.Vnode
    whenCaught(
        callback: V.WhenCaughtCallback,
        ...children: V.Vnode[]
    ): V.Vnode
    whenReady(
        callback: V.WhenReadyCallback<V.ComponentInfo<Polymorphic>>,
        ...children: V.Vnode[]
    ): V.Vnode
    whenLayout(
        callback: V.WhenLayoutCallback<V.ComponentInfo<Polymorphic>>,
        ...children: V.Vnode[]
    ): V.Vnode
    whenRemoved(
        callback: V.WhenRemovedCallback<V.ComponentInfo<Polymorphic>>,
        ...children: V.Vnode[]
    ): V.Vnode
    whenLayoutRemoved(
        callback: V.WhenLayoutRemovedCallback<V.ComponentInfo<Polymorphic>>,
        ...children: V.Vnode[]
    ): V.Vnode
}

function createTaggedVnode(
    tag: string | V.RefValue,
    attrs: APIOptional<
        | V.ElementAttributesObject
        | SugaredAttributes
        | V.Vnode
    >,
    data: Any[]
): V.Vnode {
    // If it's empty, don't retain it.
    if (isEmpty(attrs)) {
        data[1] = attrs = void 0
    }

    // If in release mode, defer the check to the runtime - it'll
    // validate and throw as necessary.
    if (__DEV__) {
        if (typeof tag === "string") {
            validateTagName(tag)
        } else if (tag != null && typeof tag !== "object") {
            throw new TypeError(
                "Only strings, components, and elements are acceptable tag " +
                "values."
            )
        }
    }

    if (attrs != null) {
        data[1] = desugarElementAttrs(attrs as SugaredAttributes)
    }

    return V.create(
        typeof tag === "string" ? V.Type.Element : V.Type.Portal,
        data as (V.VnodeElement | V.VnodePortal)["_"]
    )
}

// FIXME: explain referencing the vnodes.md design doc why the `data` values are
// built the way they are. (I'm optimizing for a specific array layout, to try
// to minimize array length for the two most common cases: zero children and a
// single child.)

export {m as default}
const m: Hyperscript = /*@__PURE__*/ (() => {
function m(
    tag: typeof Fragment | string | V.PolymorphicComponent | V.RefValue,
    attrs: APIOptional<
        | V.ElementAttributesObject
        | SugaredAttributes
        | ComponentAttributes
        | V.Vnode
    >
): V.Vnode {
    // Fairly rare, but let's fast path it anyways. Worst case scenario, the CPU
    // determines it to be an unlikely branch, and so the cost of it is near
    // zero.
    if (tag === Fragment) {
        return createFragmentFromArguments.apply(
            (
                attrs != null &&
                typeof (attrs as Partial<V.VnodeNonPrimitive>)[""] === "number"
            ) ? 1 : 2,
            arguments
        )
    }

    if (typeof tag === "function") {
        if (attrs == null) {
            attrs = {children: createFragmentFromArguments.apply(2, arguments)}
        } else if (
            typeof (attrs as Partial<V.VnodeNonPrimitive>)[""] === "number"
        ) {
            attrs = {children: createFragmentFromArguments.apply(1, arguments)}
        } else {
            const children = (attrs as Exclude<typeof attrs, V.Vnode>).children
            if (children == null) {
                attrs = assign<typeof attrs>(
                    {children: createFragmentFromArguments.apply(2, arguments)},
                    attrs
                )
            }
        }

        return V.create(V.Type.Component, [
            tag as V.PolymorphicComponent,
            attrs as V.ComponentAttributesObject
        ])
    }

    const data: Any[] = []

    if (
        attrs != null &&
        typeof (attrs as Partial<V.VnodeNonPrimitive>)[""] === "number"
    ) {
        // If no attrs argument is present at all, we have to push the tag first
        // so it's guaranteed to be there. The second item in the array is just
        // going to be overwritten anyways, so putting the tag there initially
        // isn't an issue.
        data.push(tag)
        attrs = void 0
    } else if (typeof tag !== "string") {
        // For portals, reduce them to a hole if they have no attributes or
        // children.
        if (isTriviallyEmpty.apply(1, arguments)) return void 0
    }

    data.push.apply(data, arguments)
    data[1] = attrs

    return createTaggedVnode(
        tag, attrs as Exclude<typeof attrs, ComponentAttributes>, data
    )
}

m.jsx = function (
    tag: typeof Fragment | TagNameString | V.PolymorphicComponent | V.RefValue,
    attrs: APIOptional<SugaredAttributes | ComponentAttributes>
): V.Vnode {
    // Check this first, so it is executed as fast as pragmatically possible.
    if (tag === Fragment) return createFragmentFromArguments.apply(2, arguments)

    if (typeof tag === "function") {
        if (attrs == null) {
            attrs = {children: createFragmentFromArguments.apply(2, arguments)}
        } else {
            const children = attrs.children
            if (children == null) {
                attrs = assign<typeof attrs>(
                    {children: createFragmentFromArguments.apply(2, arguments)},
                    attrs
                )
            }
        }

        return V.create(V.Type.Component, [
            tag as V.PolymorphicComponent,
            attrs as V.ComponentAttributesObject
        ])
    }

    // For portals, reduce them to a hole if they have no attributes or
    // children. `attrs` is checked explicitly as a micro-optimization.
    if (typeof tag !== "string" && attrs == null) {
        if (isTriviallyEmpty.apply(2, arguments)) return void 0
    }

    const data: Any[] = []
    data.push.apply(data, arguments)
    return createTaggedVnode(
        tag, attrs as Exclude<typeof attrs, ComponentAttributes>, data
    )
}

m.RETAIN = RETAIN

m.link = makeProxy.bind(V.Type.Link)
m.whenCaught = makeProxy.bind(V.Type.WhenCaught)

m.state = (init: V.StateInit<V.StateValue>): V.Vnode =>
    V.create(V.Type.State, init)

m.trust = (text: Exclude<Any, symbol>): V.Vnode => {
    // Extremely unsafe typing: we're taking an arbitrary value and turning it
    // into a trusted string. This also falls in line with the risks the user is
    // taking by using this.
    const resolved = String(text)
    return resolved === ""
        ? void 0
        : V.create(V.Type.Trust, resolved as Any as TrustedString)
}

m.if = (cond: boolean, blocks: IfElseBlocks): V.Vnode => {
    cond = !!cond
    const block = cond ? blocks.then : blocks.else
    if (block == null) return void 0
    const vnode = block.call(blocks)
    if (vnode == null || typeof vnode === "boolean") return void 0
    return V.create(V.Type.Link, [
        cond as Any as V.LinkValue,
        void 0,
        vnode
    ])
}

m.each = <T extends Polymorphic>(
    // The redundancy here is just for the guard to work.
    coll: T[] | Iterable<T>,
    keySelector: _KeyFrom<T> | _KeySelector<T>,
    view: (value: T, index: number) => V.Vnode
): V.Vnode => {
    // Iterators are rare and arrays are easier to iterate - let's not optimize
    // for those.
    let resolved: T[]

    if (Array.isArray(coll)) {
        resolved = coll
    } else {
        resolved = Array.from(coll)
        // Shortcut empty iterators, too.
    }

    // Shortcut this as early as possible as it's a very common case.
    if (resolved.length === 0) return void 0

    const data = [] as Array<V.Vnode | V.KeyValue>

    // Specialize the function call and key access variants. The function call
    // variant will be substantially slower than the key access one, and
    // doing any sort of branching there is a terrible idea. (It's even worse
    // considering that the `view` function call will likely result in coming
    // back to a bad CPU cache, mitigating any wins from even memoizing inside
    // the loop.)
    if (typeof keySelector !== "function") {
        // Stringify it early, to avoid that overhead within the loop.
        if (typeof keySelector !== "symbol") {
            keySelector = `${keySelector}` as _KeyFrom<T>
        }

        for (let i = 0, len = resolved.length; i < len; i++) {
            const item = resolved[i]
            const child = view(item, i)
            if (child != null && typeof child !== "boolean") {
                // Have to cast to `Polymorphic` because TS doesn't understand
                // that symbols are valid keys (and thus infer the return type
                // correctly)
                data.push(item[keySelector] as Polymorphic as V.KeyValue, child)
            }
        }
    } else {
        for (let i = 0, len = resolved.length; i < len; i++) {
            const item = resolved[i]
            const child = view(item, i)
            if (child != null && typeof child !== "boolean") {
                data.push(keySelector(item, i), child)
            }
        }
    }

    if (__DEV__) {
        const set = new KeySet.T()

        for (let i = 0; i < data.length; i += 2) {
            if (KeySet.has(set, data[i])) {
                throw new TypeError(
                    `Duplicate key ${String(data[i])} not allowed`
                )
            }
            KeySet.add(set, data[i])
        }
    }

    return V.create(V.Type.Keyed, data)
}

m.transition = (options: V.TransitionOptions, child: V.VnodeElement): V.Vnode =>
    V.create(V.Type.Transition, [void 0, options, child])

m.whenReady = function (
    callback: V.WhenReadyCallback<V.ComponentInfo<Polymorphic>>
): V.Vnode {
    const children = createFragmentFromArguments.apply(1, arguments)
    return V.create(V.Type.State, (info) => {
        info.whenReady(callback)
        return children
    })
}

m.whenLayout = function (
    callback: V.WhenLayoutCallback<V.ComponentInfo<Polymorphic>>
): V.Vnode {
    const children = createFragmentFromArguments.apply(1, arguments)
    return V.create(V.Type.State, (info) => {
        info.whenLayout(callback)
        return children
    })
}

m.whenRemoved = function (
    callback: V.WhenRemovedCallback<V.ComponentInfo<Polymorphic>>
): V.Vnode {
    const children = createFragmentFromArguments.apply(1, arguments)
    return V.create(V.Type.State, (info) => {
        info.whenRemoved(callback)
        return children
    })
}

m.whenLayoutRemoved = function (
    callback: V.WhenLayoutRemovedCallback<V.ComponentInfo<Polymorphic>>
): V.Vnode {
    const children = createFragmentFromArguments.apply(1, arguments)
    return V.create(V.Type.State, (info) => {
        info.whenLayoutRemoved(callback)
        return children
    })
}

// This should always align with the hyperscript version they're plugged into -
// it's not supported to use such tags from other instances.
m.Fragment = Fragment

return m as Hyperscript
})()
