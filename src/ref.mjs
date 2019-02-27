const missing = {}

export const ROOT = {}

export function join(callback) {
	let remaining = 1
	let refs = Object.create(null)
	const values = Object.create(null)

	function finish() {
		if (--remaining === 0) {
			const func = callback
			callback = refs = undefined
			func(values)
		}
	}

	return (key) => {
		if (key == null) return values
		if (key === ROOT) return finish
		if (refs[key] != null) return refs[key]
		remaining++
		values[key] = missing
		return refs[key] = (value) => {
			const prev = values[key]
			values[key] = value
			if (prev === missing) finish()
		}
	}
}

export function all(callback) {
	let remaining = 1
	let refs = []
	const values = []

	function finish() {
		if (--remaining === 0) {
			const func = callback
			callback = refs = undefined
			func(values)
		}
	}

	return (index) => {
		if (index == null) return values
		if (index === ROOT) return finish
		// Cast this to a 32-bit integer
		index |= 0 // eslint-disable-line no-bitwise
		if (index < 0) throw new TypeError("Array index must be positive")
		if (index <= refs.length && refs[index] != null) return refs[index]
		remaining++
		// Keep the arrays dense at all times
		for (var i = values.length; i < index; i++) values[i] = undefined
		for (var i = refs.length; i < index; i++) refs[i] = undefined
		values[index] = missing
		return refs[index] = (value) => {
			const prev = values[index]
			values[index] = value
			if (prev === missing) finish()
		}
	}
}
