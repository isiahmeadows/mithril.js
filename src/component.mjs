// This uses ES2019's `Object.fromEntries` in `join` for simplicity
import * as Vnodes from "mithril/vnodes"
import {Control, Fragment, Keyed, Raw, Text, m, normalize} from "mithril/m"

function isObject(value) {
	return value != null && typeof value === "object"
}

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
					context.renderSync(wrapRedraw(normalize(result)))
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
			return Object.fromEntries(
				Object.entries(attrs).map(([key, value]) => {
					if (!key.startsWith("on")) return [key, value]
					if (typeof value !== "function") {
						if (isComponent || !isObject(value)) return [key, value]
					}
					return [key, function (ev) {
						let result = false
						if (typeof value === "function") {
							result = value.apply(this, arguments)
						} else {
							value.handleEvent(ev)
							result = Boolean(ev.defaultPrevented)
						}
						if (result !== false) redraw()
						return result
					}]
				})
			)
		}

		function wrapRedraw(child) {
			const tag = Vnodes.tag(child)
			switch (tag) {
				case Text: case Raw: case Control: return child
				case Keyed: case Fragment: {
					const {children, ...attrs} = Vnodes.attrs(child)
					return m(tag, {
						...attrs,
						children: children.map(wrapRedraw)
					})
				}
				default:
					if (typeof tag === "function") {
						return m(tag, bindProperties(Vnodes.attrs(child), true))
					} else {
						const {children, ...attrs} = Vnodes.attrs(child)
						return m(tag, {
							...bindProperties(attrs, false),
							children: children.map(wrapRedraw)
						})
					}
			}
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
