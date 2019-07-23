// Usually inlined
export var TypeReplace = 0
export var TypeElement = 1
export var TypeConfig = 2
export var TypeKeyed = 3

export function vnode(type, field1, field2) {
    return {"%type": type, a: field1, b: field2}
}

export function replace(child) {
    return child != null && child.$type === 0
        ? child
        : vnode(TypeReplace, null, child)
}

export function isHole(value) {
    return value == null || value === Boolean(value)
}

export function isVnode(value) {
    return (
        // `null`, `undefined`, `true`, and `false`
        isHole(value) ||
        // strings, numbers, symbols, streams, etc.
        typeof value !== "object" ||
        // arrays
        Array.isArray(value) ||
        // vnodes
        typeof value.$type === "number"
    )
}
