// Note:
// `state === 0`: Init
// `state === 1`: Loading
// `state === 2`: Ready
// `state === 3`: Error
// `state === 4`: Destroyed

function Async(attrs) {
	return function (render) {
		var state = 0
		var value, current

		function destroy() {
			var prevState = state
			var prevValue = value
			state = 4; value = void 0
			try {
				if (prevState === 1) {
					for (var i = 0; i < prevValue.length; i++) {
						(0, prevValue[i])()
					}
				} else if (prevState === 2) {
					current.destroy(value)
				} else {
					return
				}
				render(current.destroyed())
			} catch (e) {
				state = 3
				render(current.error(e))
			}
		}

		var done = attrs(function (methods) {
			if (state === 0) {
				state = 1
				current = methods

				new Promise(function (resolve) {
					resolve(methods.init(function (f) {
						if (state === 1) value.push(f)
					}))
				}).then(
					function (v) {
						if (state !== 1) return
						state = 2; value = v
						render(current.ready(v, destroy))
					},
					function (e) {
						if (state !== 4) return
						state = 3; value = void 0
						render(current.error(e))
					}
				)
			}

			render(methods[state]())
		})

		return function () {
			try {
				if (done != null) done()
			} finally {
				destroy()
			}
		}
	}
}

export {Async as default}
