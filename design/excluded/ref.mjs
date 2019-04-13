const PENDING = {}
const HOLE = {}

export default function Ref(attrs) {
	return (context) => attrs({next: (current) => {
		const isArray = current.all != null
		const callback = isArray ? current.all : current.join
		let created = 0, hasRoot = false
		const values = isArray ? [] : Object.create(null)

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

		return context.next(current.children((...args) => {
			if (args.length === 0) return values
			let key = args[0]
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
					const length = values.length
					if (key <= values.length && values[key] !== HOLE) {
						break added
					}
					// Keep the array dense at all times
					values.length = key + 1
					values.fill(HOLE, length, key)
				} else if (Object.prototype.hasOwnProperty.call(values, key)) {
					break added
				}
				created++
				values[key] = PENDING
			}
			return (value) => {
				values[key] = value
				return finish()
			}
		}))
	}})
}
