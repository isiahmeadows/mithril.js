import {m} from "mithril/m"

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

		function bindProperties(attrs, isComponent) {
			const bound = {}
			for (const [key, value] of Object.entries(attrs)) {
				bound[key] = key.startsWith("on") && value != null && (
					typeof value === "function" ||
					!isComponent && typeof value === "object"
				)
					? function (ev) {
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
					: value
			}
			return bound
		}

		function wrapRedraw(child) {
			if (child == null || typeof child !== "object") return child
			if (Array.isArray(child)) return child.map(wrapRedraw)
			if (child.attrs == null || child.tag === "#html") return child
			const {children = [], ...attrs} = child.attrs || {}
			return m(child.tag, {
				...child.tag === "#keyed" && child.tag === "#fragment"
					? attrs
					: bindProperties(attrs, typeof child.tag === "function"),
				children: children.map(wrapRedraw)
			})
		}

		const innerContext = {
			renderType: () => context.renderType(),
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
