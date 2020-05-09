import * as V from "./internal/vnode"
import {arrayify, assertDevelopment} from "./internal/util"
import {TrustedString} from "./internal/dom"

interface IfElseBlocks {
    then(): V.Vnode
    else(): V.Vnode
}

type Component = V.Component<V.VnodeAttributes, V.StateValue>

type _KeyFrom<T extends Polymorphic> =
    {[P in keyof T]: T[P] extends V.KeyValue ? P : never}[keyof T]

type _KeySelector<T extends Polymorphic> =
    (value: T, index: number) => V.KeyValue

interface Hyperscript {
    (tag: string, ...children: V.Vnode[]): V.VnodeElement
    (tag: Component, ...children: V.Vnode[]): V.VnodeComponent
    RETAIN: V.VnodeRetain
    catch(callback: V.CatchCallback, ...children: V.Vnode[]): V.VnodeCatch
    link(id: V.LinkValue, ...children: V.Vnode[]): V.VnodeLink
    state(initializer: V.StateInit<V.StateValue>): V.VnodeState
    trust(text: Any): V.VnodeTrust
    if(cond: boolean, blocks: IfElseBlocks): V.VnodeLink
    each<T extends Polymorphic>(
        coll: Iterable<T>,
        keySelector: _KeyFrom<T> | _KeySelector<T>,
        view: (value: T, index: number) => V.Vnode
    ): V.VnodeLink
    Fragment: V.Component<V.VnodeAttributes, Any>
    Attrs: V.Component<V.VnodeAttributes, Any>
    create<T extends V.VnodeNonPrimitive>(type: T["%"], value: T["_"]): T
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
            tag, index,
            "String selectors must not contain empty class names."
        )
    }
}

function createFromArgs<
    T extends V.NonPrimitiveParentVnode
>(this: T["%"], ...args: T["_"]): T
function createFromArgs<T extends V.NonPrimitiveParentVnode>(this: T["%"]): T {
    return V.create(this, arrayify.apply(0, arguments) as T["_"])
}

export {m as default}
const m: Hyperscript = /*@__PURE__*/ (() => {
function m(tag: string, ...children: V.Vnode[]): V.VnodeElement
function m(tag: Component, ...children: V.Vnode[]): V.VnodeLink
function m(tag: string | Component, attrs: V.Vnode): V.Vnode {
    if (tag === m.Attrs) return attrs
    if (tag === m.Fragment) return arrayify.apply<1, V.Vnode[]>(1, arguments)

    if (typeof tag === "string") {
        // If in release mode, defer the check to the runtime - it'll
        // validate and throw as necessary.
        if (__DEV__) validateTagName(tag)
    } else if (typeof tag !== "function") {
        throw new TypeError(
            "The selector must be either a string or a component."
        )
    }

    return createFromArgs.apply<
        typeof tag extends string ? V.Type.Element : V.Type.Component,
        typeof tag extends string ? V.VnodeElement : V.VnodeComponent
    >(
        (typeof tag === "string" ? V.Type.Element : V.Type.Component) as
            typeof tag extends string ? V.Type.Element : V.Type.Component,
        arguments
    )
}

m.create = V.create
m.RETAIN = V.create<V.VnodeRetain>(V.Type.Retain, void 0)

m.catch = createFromArgs.bind(V.Type.Catch)
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
m.Fragment = () => {
    throw new TypeError("This component is not meant to be invoked directly.")
}

m.Attrs = () => {
    throw new TypeError("This component is not meant to be invoked directly.")
}

return m as Hyperscript
})()
