// This is highly optimized to minimize retained and allocated memory.
var pending = {}
var hole = {}
var hasOwn = Object.prototype.hasOwnProperty
var fill = Array.prototype.fill || function (value, start, end) {
	while (start !== end) this[start++] = value
}

export function join(callback) {
	var created = 0, mounted = 0
	var values = Object.create(null), remove = hole

	function finish() {
		if (created !== 0 && --created === 0) {
			var func = callback
			callback = undefined
			var result = func(values)
			if (typeof result !== "function") result = undefined
			remove = result
		}
		return removeHook
	}

	function removeHook() {
		if (mounted !== 0 && --mounted === 0 && remove != null) {
			var func = remove
			remove = undefined
			func()
		}
	}

	return function (key) {
		if (key == null) return values
		if (key === join) {
			if (remove === hole) { remove = pending; created++; mounted++ }
			return finish
		}
		if (!hasOwn.call(values, key)) {
			created++; mounted++
			values[key] = pending
		}
		return function (value) {
			var prev = values[key]
			values[key] = value
			if (prev === pending) return finish()
		}
	}
}

export function all(callback) {
	var created = 0, mounted = 0
	var values = [], remove = hole

	function finish() {
		if (created !== 0 && --created === 0) {
			var func = callback
			callback = undefined
			for (var i = 0; i < values.length; i++) {
				if (values[i] === hole) values[i] = undefined
			}
			var result = func(values)
			if (typeof result !== "function") result = undefined
			remove = result
		}
		return removeHook
	}

	function removeHook() {
		if (mounted !== 0 && --mounted === 0 && remove != null) {
			var func = remove
			remove = undefined
			func()
		}
	}

	return function (index) {
		if (index == null) return values
		if (index === all) {
			if (remove === hole) { remove = pending; created++; mounted++ }
			return finish
		}
		// Cast this to a 32-bit integer
		index |= 0 // eslint-disable-line no-bitwise
		if (index < 0) throw new TypeError("Array index must be positive")
		var length = values.length
		if (index > values.length || values[index] === hole) {
			created++; mounted++
			// Keep the array dense at all times
			values.length = index + 1
			fill.call(values, hole, length, index)
			values[index] = pending
		}
		return function (value) {
			var prev = values[index]
			values[index] = value
			if (prev === pending) return finish()
		}
	}
}
