import {assign} from "./internal/util.mjs"
import {mergeAttrsChildren} from "./internal/vnode.mjs"

var tagParser = /^[^#.[\]]+/
var selectorParser = /(?:([#.])([^#.[\]]+))|(\[(.+?)(?:\s*=\s*("|'|)((?:\\["'\]]|.)*?)\5)?\])/g
var selectorCache = {}
var hasOwn = {}.hasOwnProperty

function isEmpty(object) {
	for (var key in object) {
		if (hasOwn.call(object, key) && (
			key !== "children" ||
			Array.isArray(object.children) && object.children.length === 0
		)) {
			return false
		}
	}
	return true
}

function compileSelector(selector) {
	var match = tagParser.exec(selector)
	if (match == null) throw new TypeError("Selectors must start with a tag name!")
	var tag = match[0], classes = [], attrs = Object.create(null)
	selectorParser.lastIndex = tag.length
	while ((match = selectorParser.exec(selector))) {
		var type = match[1], value = match[2]
		if (type === "#") attrs.id = value
		else if (type === ".") classes.push(value)
		else if (match[3][0] === "[") {
			var attrValue = match[6]
			if (attrValue) attrValue = attrValue.replace(/\\(["'])/g, "$1").replace(/\\\\/g, "\\")
			if (match[4] === "class" || match[4] === "className") classes.push(attrValue)
			else attrs[match[4]] = attrValue === "" ? attrValue : attrValue || true
		}
	}
	if (classes.length > 0) attrs.className = classes.join(" ")
	return {tag: tag, attrs: attrs}
}

function execSelector(state, attrs) {
	var newAttrs = attrs

	if (isEmpty(state.attrs)) {
		if (isEmpty(attrs)) newAttrs = {children: []}
	} else if (isEmpty(attrs)) {
		newAttrs = state.attrs
	} else {
		newAttrs = {}
		assign(newAttrs, state.attrs)
		assign(newAttrs, attrs)
		var className = attrs.class != null ? attrs.class : attrs.className
		if (className != null || state.attrs.className != null) {
			newAttrs.className = className != null
				? state.attrs.className != null
					? String(state.attrs.className) + " " + String(className)
					: className
				: state.attrs.className != null
					? state.attrs.className
					: null
		}
		newAttrs.class = null
	}

	if (newAttrs.class != null) {
		if (newAttrs === attrs) {
			newAttrs = {}
			assign(newAttrs, attrs)
		}
		newAttrs.className = newAttrs.class
		newAttrs.class = null
	}

	return {tag: state.tag, attrs: newAttrs}
}

function m(selector) {
	return create(selector, mergeAttrsChildren.apply(undefined, arguments))
}

function create(selector, attrs) {
	if (
		selector == null ||
		typeof selector !== "string" &&
		typeof selector !== "function"
	) {
		throw new Error("The selector must be either a string or a component.")
	}

	if (typeof selector === "string" && selector[0] !== "#") {
		return execSelector(
			selectorCache[selector] || (
				selectorCache[selector] = compileSelector(selector)
			),
			attrs
		)
	}

	return {tag: selector, attrs: attrs}
}

var Fragment = "#fragment"
var Keyed = "#keyed"
var Catch = "#catch"

function withScope(receiver, scope) {
	return function (event) {
		return receiver({type: event.type, scope: scope, value: event})
	}
}

var sentinel = {}
function createStream(init) {
	return function (hooks) {
		if (hooks == null) hooks = {}
		var done = sentinel
		var maybeDone = init({
			next: function (value) {
				var prev = hooks
				if (prev != null && prev.next != null) prev.next(value)
			},
			error: function (value) {
				var prev = hooks
				hooks = done = undefined
				if (prev != null && prev.error != null) prev.error(value)
			},
			complete: function () {
				var prev = hooks
				hooks = done = undefined
				if (prev != null && prev.complete != null) prev.complete()
			},
		})
		if (sentinel !== done) done = maybeDone

		return function () {
			var prev = done
			done = undefined
			if (typeof prev === "function") prev()
		}
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
				o.next({tag: "#lazy", children: [function (context) {
					innerContext.context = context
					return wrapRedraw(view(next, prev))
				}]})
			}

			function wrapRedraw(child) {
				if (child == null || typeof child !== "object") return child
				if (Array.isArray(child)) return child.map(wrapRedraw)
				if (child.tag == null || child.tag === "#lazy") return child
				var isComponent = typeof child.tag === "function"
				var bound = Object.create(null)
				assign(bound, child.attrs)
				if (Array.isArray(bound.on)) {
					var result = bound.on = bound.on.slice()
					var receiver = result[0]
					result[0] = function (ev) {
						var result = receiver(ev)
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
	m, m as default, create,
	withScope, createStream,
	component, pure,
	Fragment, Keyed, Catch,
}
