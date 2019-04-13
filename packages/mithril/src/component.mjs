export default function component(init) {
	return function (attrs) {
		return function (_, context) {
			var locked = false
			var view, currentAttrs

			function render(prev, next) {
				if (locked) {
					throw new TypeError("Cannot perform a sync redraw while rendering!")
				}
				locked = true
				try {
					var result = view(prev, next)
					if (result != null) {
						context.renderSync(wrapRedraw(result))
					}
				} finally {
					locked = false
				}
			}

			function redrawSync() {
				render(currentAttrs, currentAttrs)
			}

			function redraw() {
				context.scheduleLayout(redrawSync)
			}

			function bindKey(key, value, isComponent) {
				if (key === "children") return wrapRedraw(value)
				if (key.startsWith("on") && value != null && (
					typeof value === "function" ||
					!isComponent && typeof value === "object"
				)) {
					return function (ev) {
						var result = false
						if (typeof value === "function") {
							result = value.apply(this, arguments)
						} else {
							value.handleEvent(ev)
							result = Boolean(ev.defaultPrevented)
						}
						if (result !== false) redraw()
						return result
					}
				} else {
					return value
				}
			}

			function wrapRedraw(child) {
				if (child == null || typeof child !== "object") return child
				if (Array.isArray(child)) return child.map(wrapRedraw)
				if (
					child.attrs == null || child.tag === "#html" ||
					child.tag === "#text"
				) return child
				var isComponent = typeof child.tag === "function"
				var bound = Object.create(null)
				for (var key in child.attrs) {
					if (Object.prototype.hasOwnProperty.call(child.attrs, key)) {
						bound[key] = bindKey(key, child.attrs[key], isComponent)
					}
				}
				return {tag: child.tag, attrs: bound}
			}

			var innerContext = {
				renderInfo: context.renderInfo,
				redraw: redraw,
				redrawSync: redrawSync,
				done: undefined,
			}

			var done = attrs(function (next) {
				if (view == null) view = init(next, innerContext)
				var prev = currentAttrs
				currentAttrs = next
				render(prev, next)
			})

			return function () {
				try {
					if (innerContext.done != null) innerContext.done()
				} finally {
					if (done != null) done()
				}
			}
		}
	}
}

export function pure(view) {
	return function (attrs) {
		return function (render) {
			var current
			return attrs(function (next) {
				var prev = current
				current = next
				var result = view(prev, next)
				if (result !== prev) render(result)
			})
		}
	}
}
