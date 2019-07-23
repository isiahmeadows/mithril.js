import {
    TypeConfig, TypeElement, TypeKeyed, TypeReplace,
    isHole, isVnode, replace, vnode,
} from "./internal/vnode.mjs"
import {emptyAttrs, emptyChildren} from "./internal/normalize-elem-attrs.mjs"
import {assign} from "./internal/util.mjs"

var tagParser = /^([^'"#.[\]][^#.[\]]*)|("|')((?:\\[\\"'\]]|[^\\"'\]])*)\2/
var selectorParser = /[#.]([^#.[\]]+)|\[([^=\]]+)(?:=("|'|)((?:\\[\\"'\]]|[^\\"'\]])*)\3)?\]/g
var selectorCache = Object.create(null)
var hasOwn = {}.hasOwnProperty

var Config = ":config"
var Keyed = ":keyed"

// Note: always check for `=== emptyAttrs` before checking this.
function isEmpty(object) {
    for (var key in object) {
        if (hasOwn.call(object, key)) {
            if (key !== "children") return false
            var children = object.children
            if (!Array.isArray(children) || children.length !== 0) return false
        }
    }
    return true
}

// `mask` in the result has two bits:
//
// 1 << 0: has keys
// 1 << 1: has class name
function compileSelector(selector) {
    var match = tagParser.exec(selector)
    if (match == null) throw new TypeError("Selectors must start with a tag name!")
    var tag = match[1] || match[2].replace(/\\([\\"'])/g, "$1")
    var attrs = Object.create(null), mask = 0, className = ""
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
        } else if ((/^class(?:name)?$/).test(attrKey)) {
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
        attrs = emptyAttrs
    } else {
        // Add the class name if it exists. Otherwise, omit it for performance
        // reasons and ease of implementation here.
        // eslint-disable-next-line no-bitwise
        if (mask === (1 << 1)) attrs.className = className

        // For hopefully obvious reasons, any `[children=...]` selector
        // attribute gets ignored unconditionally.
        attrs.children = emptyChildren

        // The attributes are frozen to discourage user modification of
        // attributes.
        Object.freeze(attrs)
    }

    // The result is frozen as it's also used as a raw vnode to cut down on
    // memory usage for the very common case of `m("tag.selector")`.
    return selectorCache[selector] = Object.freeze(
        vnode(TypeElement, tag, attrs)
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

// 0 = fragment (same as `TypeReplace`)
// Others are used as raw vnode types.
function createSpecial(type, attrs, children) {
    if (
        children != null ||
        attrs != null && !isHole(children = attrs.children)
    ) {
        // I'm leaving the bounds check here implicit. Either I'm doing it
        // or the engine is, and my bounds check is likely going to be
        // slower anyways.
        if (Array.isArray(children)) children = children[0]
        if (typeof children === "function") {
            if (type === TypeKeyed) {
                if (attrs.list == null) {
                    throw new TypeError("A collection is required!")
                }
                if (attrs.by == null) {
                    throw new TypeError("A key is required!")
                }
                attrs = {list: attrs.list, by: attrs.by}
            }
            return vnode(type, attrs, children)
        }
    }

    throw new TypeError("A child function body is required!")
}

function create(selector, attrs, children, initialAttrs) {
    if (attrs == null) {
        attrs = {children: children}
    } else if (isHole(attrs.children)) {
        if (isHole(children)) children = emptyChildren
        else if (!Array.isArray(children)) children = [children]
        if (attrs === initialAttrs) attrs = assign({}, attrs)
        attrs.children = children
    }

    return vnode(TypeElement, selector, attrs)
}

// This is the JSX entry point and it has four prototypes:
// jsx(0, null, ...children)
// jsx(tagOrComponent, attrsOrNull, ...children)
function jsx(selector, attrs) {
    var children = emptyChildren
    if (arguments.length > 2) {
        for (var i = 2; i < arguments.length; i++) children.push(arguments[i])
    }

    if (selector === 0) return children

    if (
        selector == null ||
        typeof selector !== "string" &&
        typeof selector !== "function"
    ) {
        throw new Error(
            "The selector must be either a string or a component."
        )
    }

    if (selector === ":keyed") {
        return createSpecial(TypeKeyed, attrs, children)
    }

    if (selector === ":config") {
        return createSpecial(TypeConfig, attrs, children)
    }

    return create(selector, attrs, children, attrs)
}

// This is the hyperscript entry point and it has four prototypes:
// m(selector)
// m(selector, child)
// m(selector, attrs)
// m(selector, attrs, child)
//
// The first few lines differentiate between the second and third forms.
//
// Note that a non-fragment `child` is sugar for `[child]`.
function m(selector, attrs, children) {
    // Has attrs or children - need to differentiate
    if (arguments.length === 2 && isVnode(attrs)) {
        children = attrs
        attrs = null
    }

    if (
        selector == null ||
        typeof selector !== "string" &&
        typeof selector !== "function"
    ) {
        throw new Error("The selector must be either a string or a component.")
    }

    var newAttrs = attrs

    if (typeof selector === "string") {
        var cached = selectorCache[selector]

        // Keep the fallback path as much out of the function as possible.
        if (cached == null) cached = compileSelector(selector)

        selector = cached.a

        if (attrs == null || attrs === emptyAttrs || isEmpty(attrs)) {
            if (selector === "keyed" || selector === "config") {
                throw new TypeError("A child function body is required!")
            }

            // This is safe - `cached` is itself a valid (frozen) vnode.
            if (children == null) return cached

            // Have to wrap the new attributes accordingly.
            attrs = newAttrs = cached.b
        } else {
            // Support `m(":keyed[by=foo]", ...)` and friends
            if (selector === ":keyed") {
                return createSpecial(TypeKeyed, attrs, children)
            }
            if (selector === ":config") {
                return createSpecial(TypeConfig, attrs, children)
            }

            // This is adequate - `cached.attrs` is always set to `emptyAttrs`
            // when no attributes exist, and never in any other circumstance.
            if (cached.b !== emptyAttrs) {
                // Don't modify the shape further beyond `assign` if we can help
                // it - just patch what's already there if we can so engines
                // supporting `Object.assign` can have better ICs.
                newAttrs = {}
                assign(newAttrs, cached.b)

                // This replaces any `children` that `state.attrs` might have.
                assign(newAttrs, attrs)

                // Search for the first of `class` and `className` to exist, and
                // use that, but normalize it to `class` so there's only one
                // source of truth. It also maps better to non-DOM renderers,
                // and the DOM renderer can itself adapt easily enough.
                for (var key in newAttrs) {
                    if (hasOwn.call(newAttrs, key)) {
                        var value
                        if (key === "class") {
                            value = String(newAttrs.class)
                            newAttrs.class = null
                        } else if (key === "className") {
                            value = String(newAttrs.className)
                        } else {
                            continue
                        }

                        var className = cached.b.className
                        // Don't coerce symbols here. It's easier, shorter, and
                        // slightly easier for engines to optimize for.
                        newAttrs.className = className != null
                            ? className + " " + value
                            : value

                        break
                    }
                }
            }
        }
    }

    return create(selector, newAttrs, children, attrs)
}

function requireVersion(context, min, max) {
    if (context == null) {
        throw new TypeError("Can't check version without a context!")
    }

    if (min == null || max == null) {
        throw new TypeError("`min` and `max` must both be defined!")
    }

    if (context.version < min || context.version > max) {
        throw new TypeError("Requires ABI version " + context.type)
    }
}

function withScope(receiver, scope) {
    return function (event, capture) {
        return receiver({type: event.type, scope: scope, value: event}, capture)
    }
}

function defineComponent(name, init, body) {
    if (name == null) name = init.name || init.displayName || "<anonymous>"
    try {
        Object.defineProperty(body, "name", {value: name})
    } finally {
        // Don't care if the above fails.
        // eslint-disable-next-line no-unsafe-finally
        return body
    }
}

function closure(name, init) {
    if (init == null) { init = name; name = null }
    return defineComponent(name, init, function (attrs, emit) {
        return function (o) {
            var view, currentAttrs
            var innerContext = {
                context: undefined,
                done: undefined,
                redraw: function () {
                    render(currentAttrs)
                },
            }

            function render(next) {
                var prev = currentAttrs
                currentAttrs = next
                o.next(vnode(TypeConfig, null, function (context) {
                    innerContext.context = context
                    // Wrap in fragment so it doesn't also `onupdate` itself.
                    return [wrapRedraw(view(next, prev, emit))]
                }))
            }

            function bindBody(vnode) {
                var body = vnode.b
                return vnode(vnode["%type"], vnode.a, function () {
                    return wrapRedraw(body.apply(this, arguments))
                })
            }

            function wrapRedraw(child) {
                if (child == null || typeof child !== "object") return child
                if (Array.isArray(child)) return child.map(wrapRedraw)
                // Defer the type error to Mithril's internal system.
                if (child.$tag == null) return child
                if (child.$tag === TypeReplace) {
                    return replace(wrapRedraw(child.b))
                }
                if (child.$tag === TypeKeyed || child.$tag === TypeConfig) {
                    return bindBody(child)
                }
                var isComponent = typeof child.$tag === "function"
                var bound = Object.create(null)
                assign(bound, child.attrs)
                if (Array.isArray(bound.on)) {
                    var result = bound.on = bound.on.slice()
                    var receiver = result[0]
                    result[0] = function (ev, capture) {
                        var result = receiver(ev, capture)
                        if (
                            result !== false ||
							isComponent || !ev.defaultPrevented
                        ) render(currentAttrs)
                        return result
                    }
                }
                bound.children = bound.children.map(wrapRedraw)
                return {tag: child.tag, attrs: bound}
            }

            attrs({next: function (next) {
                if (view == null) view = init(next, innerContext, emit)
                render(next)
            }})

            return function () {
                if (innerContext.done != null) innerContext.done()
            }
        }
    })
}

function pure(name, init) {
    if (init == null) { init = name; name = null }
    return defineComponent(name, init, function (attrs, emit) {
        return function (o) {
            var current
            return attrs({next: function (next) {
                var prev = current
                current = next
                o.next(init(next, prev, emit))
            }})
        }
    })
}

export {
    m, m as default, jsx, create, vnode, replace,
    Config, Keyed,
    withScope, requireVersion,
    closure, pure,
}
