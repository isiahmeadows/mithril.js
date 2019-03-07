// This is mostly equivalent to `./async.mjs`, but without all the
// optimizations.

export function Async(attrs) {
	return (context, [state, value, hooks] = ["loading"]) => {
		if (state === "loading" && hooks == null) {
			hooks = []
			new Promise((resolve) => resolve(attrs.init((f) => {
				if (state === "loading") hooks.push(f)
			}))).then(
				(v) => { context.update(["ready", v]) },
				(e) => { context.update(["error", e]) }
			)
		}

		function destroy(automatic) {
			// Let's be fault tolerant in case the user has a bug where they
			// retain the `destroy` ref too long.
			if (state !== "loading" && (automatic || state !== "ready")) return
			// Let's actually catch any errors from loading, since
			// we can realistically handle them.
			new Promise((resolve) => resolve(
				state === "loading"
					? hooks.forEach((hook) => { hook() })
					: attrs.destroy(value)
			)).then(
				(v) => { context.update(["ready", v]) },
				(e) => { context.update(["error", e]) }
			)
		}

		return {
			state: [state, value],
			value: attrs[state](value),
			ref: () => destroy(true),
			done: () => destroy(false),
		}
	}
}
