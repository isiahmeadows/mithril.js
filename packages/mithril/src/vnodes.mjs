// This uses quite a few bit hacks to shave off a lot of comparison time, in
// addition to strategic, limited type checks.
/* eslint-disable no-bitwise */

// Note: `normalize` is used in core in a very critical path. It needs to be
// simple and fast.

// Types:
// - Holes, empty fragments: `null`
// - Retain:    `(vnode["%type"] & 127) === 0`
// - Attribute: `(vnode["%type"] & 127) === 1`
// - Text:      `(vnode["%type"] & 127) === 2`
// - Fragment:  `(vnode["%type"] & 127) === 3`
// - Element:   `(vnode["%type"] & 127) === 4`
// - Component: `(vnode["%type"] & 127) === 5`
// - Link:      `(vnode["%type"] & 127) === 6`
// - Keyed:     `(vnode["%type"] & 127) === 7`
// - Capture:   `(vnode["%type"] & 127) === 8`
// - Static hint: `1 << 7` set in first argument

export function create(type, a, b) {
    return {"%type": type, a: a, b: b}
}

export function isNormalized(vnode) {
    return vnode === null ||
        typeof vnode === "object" &&
        !Array.isArray(vnode) &&
        vnode["%type"] === (vnode["%type"] | 0)
}

export function normalize(vnode) {
    if (vnode == null || typeof vnode === "boolean") return null
    if (typeof vnode !== "object") {
        return create(2 /* text */, String(vnode), void 0)
    }
    if (!Array.isArray(vnode)) {
        if (vnode["%type"] === (vnode["%type"] | 0)) return vnode
        return create(1 /* attribute */, vnode, void 0)
    }
    if (vnode.length === 0) return null
    var result = []
    for (var i = 0; i < vnode.length; i++) result.push(normalize(vnode[i]))
    return create(3 /* fragment */, void 0, result)
}

export function isStatic(vnode) {
    return vnode === null ||
        typeof vnode === "object" &&
        !Array.isArray(vnode) &&
        (vnode["%type"] & 1 << 7) !== 0
}

export function getTag(vnode) {
    if (vnode == null || typeof vnode === "boolean") return "#empty"
    if (typeof vnode !== "object") return "text"
    if (Array.isArray(vnode)) {
        return vnode.length === 0 ? "#empty" : "#fragment"
    }
    var type = vnode["%type"]
    if (type !== (type | 0)) return "#attrs"
    switch (type & 127) {
    case 0: return "#retain"
    case 1: return "#attrs"
    case 2: return "#text"
    case 3: return "#fragment"
    case 4:
    case 5: return vnode.a
    case 6: return "#link"
    case 7: return "#keyed"
    case 8: return "#capture"
    default: throw new Error("unknown type: " + (type & 127))
    }
}

export function getData(vnode) {
    if (vnode != null && typeof vnode !== "boolean") {
        if (typeof vnode !== "object") return String(vnode)
        if (!Array.isArray(vnode)) {
            var type = vnode["%type"]
            if (type !== (type | 0)) return vnode
            type &= 127
            if (type > 8) throw new Error("unknown type: " + type)
            // Indexing a bit mask makes this only one short step.
            // `0x1C6 === 0b1_1100_0110` - this has bits 1, 2, 6, 7, and 8 set.
            // (These bits align to the given types explained at the beginning
            // of this module in a long comment.)
            // Testing existence in this is as simple as testing whether this
            // integer has a bit set in the position at the integer to test.
            // It's similar to how integer hash maps are usually implemented,
            // but just specialized to a very small set size.
            if (0x1C6 & 1 << type) return vnode.a
        }
    }
    return undefined
}

export function getChildren(vnode) {
    if (vnode != null && typeof vnode === "object") {
        if (Array.isArray(vnode)) {
            if (vnode.length) return vnode
        } else {
            var type = vnode["%type"]
            if (type === (type | 0)) {
                type &= 127
                if (type > 8) throw new Error("unknown type: " + type)
                // This is a similar story to that in `getData`, but checks for
                // bits 3-7 instead.
                if (0x0F8 & 1 << type) return vnode.b
            }
        }
    }
    return undefined
}
