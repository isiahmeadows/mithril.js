import * as V from "./internal/vnode"
import {
    Fragment, validateTagName, desugarElementAttrs,
    SugaredAttributes, ComponentAttributes,
} from "./internal/hyperscript-common"
import {arrayify} from "./internal/util"

export type Component = V.Component<V.AttributesObject, V.StateValue>

export {Fragment}

export function jsx(tag: typeof Fragment, attrs: APIOptional<SugaredAttributes>, ...children: V.Vnode[]): V.VnodeFragment
export function jsx(tag: string, attrs: APIOptional<SugaredAttributes>, ...children: V.Vnode[]): V.VnodeElement
export function jsx(tag: Component, attrs: APIOptional<ComponentAttributes>, ...children: V.Vnode[]): V.VnodeComponent
export function jsx(tag: V.RefValue, attrs: APIOptional<SugaredAttributes>, ...children: V.Vnode[]): V.VnodePortal
export function jsx(
    tag: typeof Fragment | string | Component | V.RefValue,
    attrs: SugaredAttributes | ComponentAttributes | V.Vnode
): V.Vnode {
    if (tag === Fragment) {
        return arrayify.apply<number, V.Vnode[]>(2, arguments)
    }

    const data = arrayify.apply(0, arguments)

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
        data as (V.VnodeElement | V.VnodeComponent | V.VnodePortal)["_"],
    )
}
