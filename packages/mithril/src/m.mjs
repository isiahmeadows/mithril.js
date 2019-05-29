import {assign} from "./internal/util.mjs"
import {emptyAttrs} from "./internal/normalize-elem-attrs.mjs"

// Follow HTML a little more closely by requiring the first letter to be an
// ASCII alpha. See this page explaining why custom elements require them:
// https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
var tagParser = /^[A-Za-z][^#.[\]]*/
var selectorParser = /[#.]([^#.[\]]+)|\[([^=\]]+)(?:=("|'|)((?:\\[\\"'\]]|[^\\"'\]])*)\3)?\]/g
var selectorCache = Object.create(null)
var hasOwn = {}.hasOwnProperty

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
	var tag = match[0], attrs = Object.create(null), mask = 0, className = ""
	selectorParser.lastIndex = tag.length
	while ((match = selectorParser.exec(selector)) != null) {
		var type = match[0].charCodeAt(0)
		var value = match[1], attrKey = match[2], attrValue = match[4]
		if (type === 0x23 /* `#` */) {
			attrs.id = value
			mask |= 1 << 0
		} else if (type === 0x2e /* `.` */) {
			// V8 does better if you exclusively use `str += constant` for some
			// reason.
			if (mask & 1 << 1) className += " "
			className += value
			mask = 1 << 0 | 1 << 1
		} else if (/^class(?:name)?$/.test(attrKey)) {
			if (attrValue) {
				// V8 does better if you exclusively use `str += constant` for
				// some reason.
				if (mask & 1 << 1) className += " "
				className += attrValue.replace(/\\([\\"'])/g, "$1")
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
			mask |= 1 << 0
		}
	}

	if (mask === 0) {
		attrs = emptyAttrs
	} else {
		// Add the class name if it exists. Otherwise, omit it for performance
		// reasons and ease of implementation here.
		if (mask === (1 << 1)) attrs.className = className

		// For hopefully obvious reasons, any `[children=...]` selector
		// attribute gets ignored unconditionally.
		attrs.children = []

		// The attributes are frozen to discourage user modification of attributes.
		Object.freeze(attrs)
	}

	// The result is frozen as it's also used as a raw vnode to cut down on
	// memory usage for the very common case of `m("tag.selector")`.
	return selectorCache[selector] = Object.freeze({tag: tag, attrs: attrs})
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

function create(selector, attrs) {
	if (typeof selector === "string" && selector[0] !== "#") {
		var cached = selectorCache[selector]

		// Keep the fallback path as much out of the function as possible.
		if (cached == null) cached = compileSelector(selector)

		// This is safe - `cached` is itself a valid (frozen) vnode.
		if (attrs === emptyAttrs || isEmpty(attrs)) return cached

		// This is adequate - `cached.attrs` is always set to `emptyAttrs` when
		// no attributes exist, and never in any other circumstance.
		if (cached.attrs !== emptyAttrs) {
			// Don't modify the shape further beyond `assign` if we can help
			// it - just patch what's already there if we can so engines
			// supporting `Object.assign` can have better ICs.
			attrs = {}
			assign(attrs, cached.attrs)

			// This replaces any `children` that `state.attrs` might have.
			assign(attrs, attrs)

			// Search for the first of `class` and `className` to exist, and use
			// that, but normalize it to `className` for better performance.
			for (var key in attrs) {
				if (hasOwn.call(attrs, key)) {
					var value
					if (key === "class") {
						value = "" + attrs.class
						attrs.class = null
					} else if (key === "className") {
						value = "" + attrs.className
					} else {
						continue
					}

					var className = cached.attrs.className
					// Don't coerce symbols here. It's easier, shorter, and
					// slightly easier for engines to optimize for.
					attrs.className = className != null
						? className + " " + value
						: value

					break
				}
			}
		}

		selector = cached.tag
	}

	return {tag: selector, attrs: attrs}
}

// JSX has different semantics than hyperscript in terms of disambiguating
// attributes from children, so we can't use the same entry point.
function jsx(selector, attrs) {
	var children, realAttrs, i

	// Do this early - it's a fairly easy and common path, and single-character
	// string comparisons are usually just a pointer comparison in engines. It
	// also avoids any implicit type checks.
	if (selector === "#") {
		switch (arguments.length) {
		case 0: case 1: case 2: return []
		case 3:
			children = arguments[0]
			return Array.isArray(children) ? children : [children]
		default:
			children = []
			for (i = 2; i < arguments.length; i++) children.push(arguments[i])
			return children
		}
	}

	if (
		selector == null ||
		typeof selector !== "string" &&
		typeof selector !== "function"
	) {
		throw new Error("The selector must be either a string or a component.")
	}

	switch (arguments.length) {
	case 0: case 1: case 2:
		return create(selector, attrs == null ? emptyAttrs : attrs)
	case 3:
		if (attrs.children != null) return create(selector, attrs)
		children = arguments[2]
		realAttrs = {}
		assign(realAttrs, attrs)
		realAttrs.children = Array.isArray(children) ? children : [children]
		return create(selector, realAttrs)
	default:
		if (attrs.children != null) return create(selector, attrs)
		children = []
		for (i = 2; i < arguments.length; i++) children.push(arguments[i])
		realAttrs = {}
		assign(realAttrs, attrs)
		realAttrs.children = children
		return create(selector, realAttrs)
	}
}

function normalizeAttrs() {
	// This also safeguards against if this is parsed in sloppy mode for
	// whatever reason (like in IE 9 or a browser with otherwise buggy strict
	// mode support).
	var attrs = arguments[1], children

	// 0 = attrs has non-array child
	// 1 = attrs has array child
	// 2 = attrs has non-array child, ignore rest
	// 3 = attrs has no child
	var type

	if (attrs == null || typeof attrs !== "object") {
		type = 0
	} else if (Array.isArray(attrs)) {
		type = 1
	} else if ((children = attrs.children) != null) {
		// If `children: ...` is present, this takes precedence in
		// determining this as an attributes object, even if `tag` is
		// present. If you want a literal attribute `tag`, you can have
		// that provided you pass `children: []` as well.
		if (Array.isArray(children)) return attrs
		type = 2
	} else if (attrs.tag != null) {
		type = 0
	} else {
		type = 3
	}

	if (arguments.length === 2) {
		children = !(type & 1) ? [attrs] : type === 1 ? attrs : []
	} else if (type !== 2) {
		reparseChildren: {
			var i = 2
			if (!(type & 2)) {
				i = 1
			} else if (arguments.length === 3) {
				children = arguments[3]
				if (!Array.isArray(children)) children = [children]
				break reparseChildren
			}
			children = []
			while (i < arguments.length) children.push(arguments[i++])
		}
	}

	var replacement = {}
	if (type & 2) assign(replacement, attrs)
	replacement.children = children
	return replacement
}

function m(selector) {
	if (
		selector == null ||
		typeof selector !== "string" &&
		typeof selector !== "function"
	) {
		throw new Error("The selector must be either a string or a component.")
	}

	var realAttrs = emptyAttrs
	var attrs, children

	// 0 = attrs has non-array child
	// 1 = attrs has array child
	// 2 = attrs has non-array child, ignore rest
	// 3 = attrs has no child
	var type

	// Let's try to short-circuit early if no attributes object is passed -
	// `m("selector")` is a *very* common idiom. It also simplifies the
	// following code quite a bit.
	normalizeAttrs:
	if (arguments.length > 1) {
		// This also safeguards against if this is parsed in sloppy mode for
		// whatever reason (like in IE 9 or a browser with otherwise buggy strict
		// mode support).
		attrs = arguments[1]

		if (attrs == null || typeof attrs !== "object") {
			type = 0
		} else if (Array.isArray(attrs)) {
			type = 1
		} else if ((children = attrs.children) != null) {
			// If `children: ...` is present, this takes precedence in
			// determining this as an attributes object, even if `tag` is
			// present. If you want a literal attribute `tag`, you can have
			// that provided you pass `children: []` as well.
			if (Array.isArray(children)) {
				realAttrs = attrs
				break normalizeAttrs
			}
			type = 2
		} else if (attrs.tag != null) {
			type = 0
		} else {
			type = 3
		}

		if (arguments.length === 2) {
			children = !(type & 1) ? [attrs] : type === 1 ? attrs : []
		} else if (type !== 2) {
			reparseChildren: {
				var i = 2
				if (!(type & 2)) {
					i = 1
				} else if (arguments.length === 3) {
					children = arguments[3]
					if (!Array.isArray(children)) children = [children]
					break reparseChildren
				}
				children = []
				while (i < arguments.length) children.push(arguments[i++])
			}
		}

		realAttrs = {}
		if (type & 2) assign(realAttrs, attrs)
		realAttrs.children = children
	}

	return create(selector, realAttrs)
}

var Fragment = "#fragment"
var Keyed = "#keyed"
var Catch = "#catch"

function withScope(receiver, scope) {
	return function (event, capture) {
		return receiver({type: event.type, scope: scope, value: event}, capture)
	}
}

function component(init) {
	return function (attrs, emit) {
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
				o.next({tag: "#fragment", children: [function (context) {
					innerContext.context = context
					return wrapRedraw(view(next, prev))
				}]})
			}

			function wrapRedraw(child) {
				if (child == null || typeof child !== "object") return child
				if (Array.isArray(child)) return child.map(wrapRedraw)
				if (child.tag == null || child.tag === "#fragment") return child
				var isComponent = typeof child.tag === "function"
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
	}
}

function pure(view) {
	return function (attrs) {
		return function (o) {
			var current
			return attrs({next: function (next) {
				var prev = current
				current = next
				var result = view(next, prev)
				if (result !== prev) o.next(result)
			}})
		}
	}
}

export {
	m, m as default, jsx, create,
	withScope,
	component, pure,
	Fragment, Keyed, Catch,
}
