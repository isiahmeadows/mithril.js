const pending = {}
const hole = {}

function combine(isArray, callback) {
	let created = 0, mounted = 0, hasRoot = false, remove
	const values = isArray ? [] : Object.create(null)

	function finish() {
		if (created !== 0 && --created === 0) {
			if (isArray) {
				for (let i = 0; i < values.length; i++) {
					if (values[i] === hole) values[i] = undefined
				}
			}
			remove = callback(values)
			if (typeof remove !== "function") remove = undefined
		}
		return removeHook
	}

	function removeHook() {
		if (mounted !== 0 && --mounted === 0) {
			if (remove != null) remove()
		}
	}

	return (key) => {
		if (key == null) return values
		if (key === join) {
			if (!hasRoot) { hasRoot = true; created++; mounted++ }
			return finish
		}
		added: {
			if (isArray) {
				// Cast this to a 32-bit integer
				key |= 0 // eslint-disable-line no-bitwise
				if (key < 0) throw new TypeError("Array index must be positive")
				const length = values.length
				if (key <= values.length && values[key] !== hole) break added
				// Keep the array dense at all times
				values.length = key + 1
				values.fill(hole, length, key)
			} else if (Object.prototype.hasOwnProperty.call(values, key)) {
				break added
			}
			created++; mounted++
			values[key] = pending
		}
		return (value) => {
			const prev = values[key]
			values[key] = value
			if (prev === pending) return finish()
		}
	}
}

export function join(callback) {
	return combine(false, callback)
}

export function all(callback) {
	return combine(true, callback)
}
