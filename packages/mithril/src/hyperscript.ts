import * as V from "./internal/vnode"
import {
    Fragment, validateTagName, desugarElementAttrs,
    SugaredAttributes, ComponentAttributes,
} from "./internal/hyperscript-common"
import {arrayify} from "./internal/util"
import {TrustedString} from "./internal/dom"

interface IfElseBlocks {
    then(): V.Vnode
    else(): V.Vnode
}

type Component = V.Component<V.AttributesObject, V.StateValue>

type _KeyFrom<T extends Polymorphic> =
    {[P in keyof T]: T[P] extends V.KeyValue ? P : never}[keyof T]

type _KeySelector<T extends Polymorphic> =
    (value: T, index: number) => V.KeyValue

interface Hyperscript {
    (tag: string, ...children: V.Vnode[]): V.VnodeElement
    (tag: string, attrs: SugaredAttributes, ...children: V.Vnode[]): V.VnodeElement
    (tag: Component, ...children: V.Vnode[]): V.VnodeComponent
    (tag: Component, attrs: ComponentAttributes, ...children: V.Vnode[]): V.VnodeComponent
    (tag: V.RefValue, ...children: V.Vnode[]): V.VnodePortal
    (tag: V.RefValue, attrs: ComponentAttributes, ...children: V.Vnode[]): V.VnodePortal
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
    Fragment: V.Component<V.AttributesObject, Any>
    create<T extends V.VnodeNonPrimitive>(type: T["%"], value: T["_"]): T
}

function createFromArgs<
    T extends V.NonPrimitiveParentVnode
>(this: T["%"], ...args: T["_"]): T
function createFromArgs<T extends V.NonPrimitiveParentVnode>(this: T["%"]): T {
    return V.create(this, arrayify.apply(0, arguments) as T["_"])
}

export {m as default}
const m: Hyperscript = /*@__PURE__*/ (() => {
function m(tag: typeof m.Fragment, ...children: V.Vnode[]): V.VnodeFragment
function m(tag: typeof m.Fragment, attrs: SugaredAttributes, ...children: V.Vnode[]): V.VnodeFragment
function m(tag: string, ...children: V.Vnode[]): V.VnodeElement
function m(tag: string, attrs: SugaredAttributes, ...children: V.Vnode[]): V.VnodeElement
function m(tag: Component, ...children: V.Vnode[]): V.VnodeComponent
function m(tag: Component, attrs: ComponentAttributes, ...children: V.Vnode[]): V.VnodeComponent
function m(tag: V.RefValue, ...children: V.Vnode[]): V.VnodePortal
function m(tag: V.RefValue, attrs: SugaredAttributes, ...children: V.Vnode[]): V.VnodePortal
function m(
    tag: typeof m.Fragment | string | Component | V.RefValue,
    attrs: SugaredAttributes | ComponentAttributes | V.Vnode
): V.Vnode {
    let start = 2

    if (
        attrs != null &&
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
    while (start < arguments.length) data.push(arguments[start++])

    return V.create(
        typeof tag === "string" ? V.Type.Element
        : typeof tag === "function" ? V.Type.Component
        : V.Type.Portal,
        data as (V.VnodeElement | V.VnodeComponent | V.VnodePortal)["_"],
    )
}

m.create = V.create
m.RETAIN = V.create<V.VnodeRetain>(V.Type.Retain, void 0)

m.link = createFromArgs.bind(V.Type.Link)
m.state = (init: V.StateInit<V.StateValue>): V.VnodeState =>
    V.create(V.Type.State, init)

m.trust = (text: Exclude<Any, symbol>): V.VnodeTrust =>
    // Extremely unsafe typing: we're taking an arbitrary value and turning it
    // into a trusted string. This also falls in line with the risks the user is
    // taking by using this.
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    V.create(V.Type.Trust, ("" + text) as Any as TrustedString)

m.if = (cond: boolean, blocks: IfElseBlocks): V.Vnode => {
    cond = !!cond
    const block = cond ? blocks.then : blocks.else
    return block == null ? null : V.create(V.Type.Link, [
        cond as Any as V.LinkValue,
        block.call(blocks)
    ])
}

function compilePropertySelector<T extends Polymorphic>(
    keySelector: _KeyFrom<T>
): _KeySelector<T> {
    const key = typeof keySelector === "symbol"
        ? keySelector
        // Coercion to a string is just so it's not done repeatedly in the
        // callback
        : `${keySelector}` as _KeyFrom<T>
    // Have to cast to `unknown` because it can't understand that symbols
    // are valid keys (and thus infer the return type correctly)
    return (value: T) => value[key] as unknown as V.KeyValue
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

        return V.create(V.Type.Keyed, data)
    } else {
        const iter = coll[Symbol.iterator]()

        try {
            for (let i = 0; ; i++) {
                const next = iter.next()
                if (next.done) return V.create(V.Type.Keyed, data)
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
}

// This should always align with the hyperscript version they're plugged into -
// it's not supported to use such tags from other instances.
m.Fragment = Fragment

return m as Hyperscript
})()
