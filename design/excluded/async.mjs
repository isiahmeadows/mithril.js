export default function Async(_, attrs) {
	return (render) => {
		let state = "init"
		let value, current

		function destroy() {
			const prevState = state
			const prevValue = value
			state = "destroyed"; value = undefined
			try {
				if (prevState === "loading") {
					prevValue.forEach((hook) => { hook() })
				} else if (prevState === "ready") {
					current.destroy(value)
				} else {
					return
				}
				render(current.destroyed())
			} catch (e) {
				state = "error"
				render(current.error(e))
			}
		}

		const done = attrs((methods) => {
			if (state === "init") {
				state = "loading"
				current = methods

				new Promise((resolve) => resolve(methods.init((f) => {
					if (state === "loading") value.push(f)
				}))).then(
					(v) => {
						if (state !== "loading") return
						state = "ready"; value = v
						render(current.ready(v, destroy))
					},
					(e) => {
						if (state !== "destroyed") return
						state = "error"; value = undefined
						render(current.error(e))
					}
				)
			}

			render(methods[state]())
			if (methods.ref) methods.ref(destroy)
		})

		return () => {
			try {
				if (done != null) done()
			} finally {
				destroy()
			}
		}
	}
}
