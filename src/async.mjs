// This is highly optimized to minimize retained memory.
import {Fragment, create, normalizeChildren} from "./m.js"

const StateLoading = 0
const StateReady = 1
const StateError = 2
const StateDestroyed = 3

export function Async(originalAttrs, context) {
	let state = StateLoading
	let value = []

	// Note: according to the latest spec, if `attrs.init` returns either a raw
	// value or resolved promise, the whole body is executed in a single
	// job/microtask. When transpiled to ES5, these semantics should remain the
	// same.
	;(async () => {
		function onClose(f) {
			if (state === StateLoading) value.push(f)
		}

		try {
			value = await originalAttrs.init(onClose)
			state = StateReady
		} catch (e) {
			state = StateError
			value = e
		} finally {
			context.update()
		}
	})()

	return (attrs) => {
		// Because `destroy` requires the latest attrs. This does this without
		// creating GC overhead.
		let children
		switch (state) {
			case StateLoading: children = attrs.children("loading"); break
			case StateReady: children = attrs.children("ready", value); break
			case StateError: children = attrs.children("error", value); break
			case StateDestroyed: children = attrs.children("destroyed"); break
			default: throw new Error(`Unknown state: ${state}`)
		}
		children = normalizeChildren(children)

		return {
			// Note: according to the latest spec, if `attrs.destroy` returns
			// either a raw value or resolved promise, the whole body is
			// executed in a single job/microtask. When transpiled to ES5, these
			// semantics should remain the same.
			ref: async () => {
				if (state === StateError || state === StateDestroyed) return
				const prev = value
				state = StateDestroyed
				value = undefined
				try {
					if (state === StateLoading) {
						for (const hook of prev) hook()
					} else {
						await attrs.destroy(prev)
					}
				} catch (e) {
					state = StateError
					value = e
				} finally {
					context.update()
				}
			},
			view: create(
				/* eslint-disable no-bitwise */
				Fragment |
				0x0800 & -(state === StateLoading) |
				0x0200 & -(children.length === 0) |
				0x1000 & -(children.length === 1),
				/* eslint-enable no-bitwise */
				undefined, undefined,
				children, undefined,
				state !== StateLoading ? undefined : () => () => {
					if (state !== StateLoading) return
					const prev = value
					state = StateDestroyed
					value = undefined
					try {
						for (const hook of prev) hook()
					} catch (e) {
						value = e
						state = StateError
						// If there's an error, let it propagate. There's no way
						// we can realistically make sense of it at this point.
						throw e
					}
				}
			),
		}
	}
}
