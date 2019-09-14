import * as Vnode from "./vnode.mjs"

// Selector grammar in PEG.js. See https://pegjs.org/ if you're confused about
// the syntax. It's not magic, I promise!
//
// Selector
//     = tag:IdentifierName attrsArray:(Attribute*) {
//         let attrs = null
//         let className = []
//         let isValue
//         if (attrsArray.length) {
//             attrs = Object.create(null)
//             for (const [key, value] of attrsArray) {
//                 if (key === "class" || key === "className") {
//                     if (value) className.push(value)
//                 } else {
//                     if (
//                         key === "is" && value != null &&
//                         (/^[a-z].*-/i).test(value)
//                     ) {
//                         isValue = value
//                     }
//                     attrs[key] = value
//                 }
//             }
//             if (className.length) attrs.class = className.join(" ")
//         }
//         return Object.freeze(
//             Vnode.create(
//                 4 /* element */,
//                 isValue ? [tag, isValue] : tag,
//                 Object.freeze([attrs])
//             )
//         )
//     }
//
// Attribute
//     = "." className:IdentifierName          { return ["class", className] }
//     / "#" id:IdentifierName                 { return ["id", id] }
//     / key:IdentifierName                    { return [key, true] }
//     / key:IdentifierName "=" value:KeyValue { return [key, value] }
//
// KeyValue
//     = value:$(KeyValueChar*)         { return value }
//     / "'" value:$(KeyValueChar*) "'" { return value }
//     / '"' value:$(KeyValueChar*) '"' { return value }
//
// KeyValueChar
//     = ![\\"'\[\]] .
//     / EscapeChar
//
// IdentifierName
//     = name:$(IdentifierChar+) { return name }
//
// IdentifierChar
//     = ![#.\[\]] .
//     / EscapeChar
//
// // It's okay to escape literally anything
// EscapeChar
//     = "\\" ch:. { return ch }
//
// TODO: test this very, *very* well.

var tagParser = /^(?:[^#.[\]]|\\[\s\S])+/
var selectorParser = /[#.]([^#.[\]\s]+)|\[((?:[^=#.[\]]|\\[\s\S])+)(?:=("|'|)((?:[^\\"'[\]]|\\[\s\S])*)\3)?\]/g
var selectorCache = Object.create(null)

// `mask` in the result has two bits:
//
// 1 << 0: has keys
// 1 << 1: has class name
function compileSelector(selector) {
    var match = tagParser.exec(selector)
    if (match == null) throw new TypeError("Selectors must start with a tag name!")
    var tag = match[0].replace(/\\([\s\S])/g, "$1")
    var attrs = Object.create(null), mask = 0, className = ""
    var isValue
    selectorParser.lastIndex = tag.length
    while ((match = selectorParser.exec(selector)) != null) {
        var type = match[0].charCodeAt(0)
        var value = match[1], attrKey = match[2], attrValue = match[4]
        if (type === 0x23 /* `#` */) {
            attrs.id = value
            // eslint-disable-next-line no-bitwise
            mask |= 1 << 0
        } else if (type === 0x2e /* `.` */) {
            // V8 does better if you exclusively use `str += constant` for some
            // reason.
            // eslint-disable-next-line no-bitwise
            if (mask & 1 << 1) className += " "
            className += value
            // eslint-disable-next-line no-bitwise
            mask = 1 << 0 | 1 << 1
        } else if ((/^class(?:Name)?$/).test(attrKey)) {
            if (attrValue) {
                // V8 does better if you exclusively use `str += constant` for
                // some reason.
                // eslint-disable-next-line no-bitwise
                if (mask & 1 << 1) className += " "
                className += attrValue.replace(/\\([\\"'])/g, "$1")
                // eslint-disable-next-line no-bitwise
                mask = 1 << 0 | 1 << 1
            }
        } else {
            if (
                attrKey === "is" && attrValue != null &&
                (/^[a-z].*-/i).test(attrValue)
            ) {
                isValue = attrValue
            }
            // Subtle difference:
            // matched value is `""`: `[key=]` -> `key: ""`
            // matched value is `null`: `[key]` -> `key: true`
            attrs[attrKey] = (
                attrValue == null ||
                attrValue.replace(/\\([\\"'])/g, "$1")
            )
            // eslint-disable-next-line no-bitwise
            mask |= 1 << 0
        }
    }

    if (mask === 0) {
        attrs = null
    } else {
        // Add the class name if it exists. Otherwise, omit it for performance
        // reasons and ease of implementation here.
        // eslint-disable-next-line no-bitwise
        if (mask === (1 << 1)) attrs.class = className

        // The attributes are frozen to discourage user modification of
        // attributes.
        Object.freeze(attrs)
    }

    // The result is frozen as it's also used as a raw vnode to cut down on
    // memory usage for the very common case of `m("tag.selector")`, and I'd
    // like to discourage vnode mutation.
    return selectorCache[selector] = Object.freeze(
        Vnode.create(
            4 /* element */,
            isValue ? [tag, isValue] : tag,
            Object.freeze([attrs])
        )
    )
}

// This is carefully laid out for a few reasons:
//
// 1. I need to reduce the number of temporary objects I create, and for those I
//    do, they need to be few enough in number that the engine can keep them all
//    in the nursery.
// 2. I need to be very conscious of how many branches are taken and how many
//    implicit type checks are performed. In particular, properties of
//    parameters are never accessed more than once except for batch copying via
//    `assign` (which uses the optimized primitive `Object.assign` on modern
//    engines).
// 3. I need to be very conscious of how types flow throughout the function, so
//    I know they get correctly interpreted by the engine as polymorphic.
//
// The reason I do it this way is so I don't have to create any temporary
// objects in this performance-critical path and so I can very tightly
// control branching.
//
// I document the algorithm pretty well throughout here, for hopefully
// obvious reasons.
//
// TODO: profile this and compare it to the existing `m` factory.
function m(selector) {
    if (
        selector == null ||
        typeof selector !== "string" &&
        typeof selector !== "function"
    ) {
        throw new Error("The selector must be either a string or a component.")
    }

    var children = []
    var type = 5 /* component */

    if (typeof selector === "string") {
        var cached = selectorCache[selector]

        // Keep the fallback path as much out of the function as possible.
        // FIXME: annotate this call once this Terser issue is resolved:
        // https://github.com/terser/terser/issues/350
        if (cached == null) cached = compileSelector(selector)

        // This is safe - `cached` is itself a valid (frozen) vnode.
        if (arguments.length === 1) return cached

        selector = cached.a
        children.push(cached.b[0])
        type = 4 /* element */
    }

    for (var i = 1; i < arguments.length; i++) children.push(arguments[i])
    return Vnode.create(type, selector, children)
}

m.RETAIN = Vnode.create(0, void 0, void 0)

m.capture = function (ref) {
    return Vnode.create(8 /* capture */, ref, void 0)
}

m.link = function (id) {
    var children = []
    for (var i = 1; i < arguments.length; i++) children.push(arguments[i])
    return Vnode.create(6 /* link */, id, children)
}

function mapEach(coll, mapper) {
    var result = []
    if (typeof mapper === "function") {
        for (var i = 0; i < coll.length; i++) {
            result.push(mapper(coll[i], i, coll))
        }
    } else {
        for (var i = 0; i < coll.length; i++) {
            result.push(coll[i][mapper])
        }
    }
    return result
}

m.each = function (coll, key, view) {
    return Vnode.create(6 /* link */, mapEach(coll, key), mapEach(coll, view))
}

m.ref = function (init) {
    return {current: init}
}

export default m
