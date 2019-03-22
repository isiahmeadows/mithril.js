// This is highly optimized to minimize retained and allocated memory.
var PENDING = {}
var HOLE = {}
var hasOwn = Object.prototype.hasOwnProperty
var fill = Array.prototype.fill || function (value, start, end) {
	while (start !== end) this[start++] = value
}

function Ref(attrs) {
	return function (context) {
		return attrs({next: function (current) {
			var isArray = current.all != null
			var callback = isArray ? current.all : current.join
			var created = 1, hasRoot = false
			var values = isArray ? [] : Object.create(null)

			function finish() {
				if (created !== 0 && --created === 0) {
					if (isArray) {
						for (let i = 0; i < values.length; i++) {
							if (values[i] === HOLE) values[i] = undefined
						}
					}
					callback(values)
				}
			}

			return context.next(current.children(function (key) {
				if (arguments.length === 0) return values
				if (key === null) {
					if (!hasRoot) { hasRoot = true; created++ }
					return finish
				}
				added: {
					if (isArray) {
						// Cast this to a 32-bit integer
						key |= 0 // eslint-disable-line no-bitwise
						if (key < 0) {
							throw new TypeError("Array index must be positive")
						}
						var length = values.length
						if (key <= values.length && values[key] !== HOLE) {
							break added
						}
						// Keep the array dense at all times
						values.length = key + 1
						fill.call(values, HOLE, length, key)
					} else if (hasOwn.call(values, key)) {
						break added
					}
					created++
					values[key] = PENDING
				}
				return function (value) {
					values[key] = value
					return finish()
				}
			}))
		}})
	}
}

export {Ref as default}
