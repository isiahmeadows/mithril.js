export default function component(init) {
	return (attrs) => (_, context) => {
		let locked = false
		let view, currentAttrs

		function render(prev, next) {
			if (locked) {
				throw new TypeError("Cannot perform a sync redraw while rendering!")
			}
			locked = true
			try {
				const result = view(prev, next)
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
					let result = false
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
			const isComponent = typeof child.tag === "function"
			const bound = Object.create(null)
			for (const key of Object.keys(child.attrs)) {
				bound[key] = bindKey(key, child.attrs[key], isComponent)
			}
			return {tag: child.tag, attrs: bound}
		}

		const innerContext = {
			renderInfo: context.renderInfo,
			redraw, redrawSync,
			done: undefined,
		}

		const done = attrs((next) => {
			if (view == null) view = init(next, innerContext)
			const prev = currentAttrs
			currentAttrs = next
			render(prev, next)
		})

		return () => {
			try {
				if (innerContext.done != null) innerContext.done()
			} finally {
				if (done != null) done()
			}
		}
	}
}

export function pure(view) {
	return (attrs) => (render) => {
		let current
		return attrs((next) => {
			const prev = current
			current = next
			const result = view(prev, next)
			if (result !== prev) render(result)
		})
	}
}
