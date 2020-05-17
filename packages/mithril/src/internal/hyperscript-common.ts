import * as V from "./vnode"
import {hasOwn, assign, assertDevelopment} from "./util"

export type ClassObject = object & {[key: string]: Any}
export type StyleObject = object & {[key: string]: Exclude<Any, symbol>}

export type SugaredAttributes = V.AttributesObject & {
    "%"?: Exclude<Any, number>
    class: Exclude<Any, object | symbol> | ClassObject
    className: Exclude<Any, object | symbol> | ClassObject
    style: Exclude<Any, object | symbol> | StyleObject
}

export type ComponentAttributes = V.AttributesObject & {
    "%"?: Exclude<Any, number>
}

export type Component = V.Component<V.AttributesObject, V.StateValue>

// Display precisely where the error is in the dev build - this will take a
// lot more space and is why the separate dev build exists - it's all for
// the dev side.
export function invalidSelector(
    selector: string, pos: number, message: string
): never {
    assertDevelopment()
    let str = `Error at offset ${pos}\n\n"${selector}"\n`
    for (let i = 0; i <= pos; i++) str += " "
    throw new SyntaxError(`${str}^\n\n${message}`)
}

export function validateTagName(tag: string): void {
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

export function Fragment() {
    throw new TypeError("This component is not meant to be invoked directly.")
}

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
                for (const key in classValue as ClassObject) {
                    if (
                        hasOwn.call(classValue, key) &&
                        (classValue as ClassObject)[key]
                    ) {
                        newClass += " " + key
                    }
                }

                if (newClass === "") break checkStyle
            } else {
                newClass = `${classValue}`
                if (/^\s*$/.test(newClass)) break checkStyle
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
                    line.slice(keyEnd + 1).trim()
            }
        }
    }

    return result
}
