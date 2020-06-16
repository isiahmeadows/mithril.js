import * as V from "./vnode"
import {hasOwn, assign} from "./util"

type ClassObject = object & {[key: string]: Any}

export type SugaredAttributes = V.ElementAttributesObject & {
    ""?: Exclude<Any, number>
    class: Exclude<Any, object | symbol> | ClassObject
    className: Exclude<Any, object | symbol> | ClassObject
    style: Exclude<Any, object | symbol> | V.StyleObject
}

export type ComponentAttributes =
    Omit<V.ComponentAttributesObject, "children"> & {
        ""?: Exclude<Any, number>
        children: APIOptional<V.Vnode[] | V.OtherComponentAttributeValue>
    }

export const RETAIN = V.create<V.VnodeRetain>(V.Type.Retain, void 0)

// This is called for literally every element and portal vnode with non-empty
// attributes, both in the JSX and hyperscript APIs. It has to be fast.
export function desugarElementAttrs(
    attrs: SugaredAttributes
): V.ElementAttributesObject {
    let result: V.ElementAttributesObject

    desugarStyle: {
        checkStyle: {
            let classValue: Exclude<Any, object> | ClassObject = attrs.className
            if (classValue == null) {
                classValue = attrs.class
                if (classValue == null || typeof classValue === "string") {
                    break checkStyle
                }
            }

            let newClass = ""

            if (typeof classValue === "object") {
                for (const key in classValue) {
                    if (hasOwn.call(classValue, key) && classValue[key]) {
                        newClass += " " + key
                    }
                }

                if (newClass === "") break checkStyle
            } else {
                newClass = `${classValue}`
                if ((/^\s*$/).test(newClass)) break checkStyle
            }

            result = assign({}, attrs)
            result.class = newClass.trim().replace(/\s+/g, " ")
            if (hasOwn.call(result, "className")) result.className = null

            if (attrs.style != null && typeof attrs.style !== "object") {
                break desugarStyle
            }

            result.style = attrs.style
            return result
        }

        if (attrs.style == null || typeof attrs.style === "object") return attrs
        result = assign({}, attrs)
    }

    const lines = `${attrs.style}`.split(";")

    if (lines.length === 0) {
        result.style = void 0
    } else {
        result.style = {}
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            const keyEnd = line.indexOf(":")
            if (keyEnd >= 0) {
                result.style[line.slice(0, keyEnd).trim()] =
                    line.slice(keyEnd + 1).trim() as Any as V.StyleObjectValue
            }
        }
    }

    return result
}
