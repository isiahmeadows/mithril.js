// This is highly optimized to minimize retained memory. It also is fairly
// fault-tolerant and dummy-proof.

// Note:
// `state.s === 0`: Loading
// `state.s === 1`: Ready
// `state.s === 2`: Error
// `state.s === 3`: Destroyed
// `(state.s & 2) === 0`: Loading or Ready
// `(state.s & 2) !== 0`: Error or Destroyed

export function Async(attrs) {
	return function (context, state) {
		var value

		if (state == null) {
			state = {s: 0, v: []}

			try {
				value = attrs.init(function (f) {
					if (state.s === 0) state.v.push(f)
				})
				if (typeof value.then === "function") {
					value.then(function (v) {
						state.s = 1
						state.v = v
						context.update()
					}, function (e) {
						state.s = 2
						state.v = e
						context.update()
					})
					return
				}
				state.s = 1
				state.v = value
				context.update()
			} catch (e) {
				state.s = 2
				state.v = e
				context.update()
			}
		}

		switch (state.s) {
			case 0: value = attrs.loading(); break
			case 1: value = attrs.ready(state.v); break
			case 2: value = attrs.error(state.v); break
			case 3: value = attrs.destroyed(); break
			default: throw new Error("Unknown state: " + state.s)
		}

		return {
			state: state, value: value,

			ref: function () {
				var current = state.s, prev = state.v
				// Let's be fault tolerant in case the user has a bug where they
				// retain the `destroy` ref too long.
				if (state.s & 2) return // eslint-disable-line no-bitwise
				state.s = 3
				state.v = undefined
				try {
					if (current === 0) {
						// Let's actually catch any errors from loading, since
						// we can realistically handle them.
						for (var i = 0; i < prev.length; i++) (0, prev[i])()
					} else {
						var result = attrs.destroy(prev)
						if (typeof result.then === "function") {
							result.then(
								function () { context.update() },
								function (e) {
									state.s = 2
									state.v = e
									context.update()
								}
							)
							return
						}
					}
				} catch (e) {
					state.s = 2
					state.v = e
				}
				context.update()
			},

			done: state.s === 0 ? function () {
				// Let's be fault tolerant in case this somehow gets
				// double-destroyed (likely due to user bug).
				if (state.s !== 0) return
				var prev = state.v
				state.s = 3
				state.v = undefined
				try {
					for (var i = 0; i < prev.length; i++) (0, prev[i])()
				} catch (e) {
					state.v = e
					state.s = 2
					// If there's an error, let it propagate. There's no way
					// we can realistically make sense of it at this point.
					throw e
				}
			} : undefined,
		}
	}
}
