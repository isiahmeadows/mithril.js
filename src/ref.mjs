const missing = {}

export function join([...keys], callback) {
	let remaining = keys.length
	const values = Object.fromEntries(keys.map((key) => [key, missing]))

	return Object.fromEntries(keys.map((key) => [key, (value) => {
		const prev = values[key]
		values[key] = value
		if (prev !== missing) return
		if (--remaining === 0) {
			const func = callback
			callback = undefined
			func(values)
		}
	}]))
}

export function all(remaining, callback) {
	remaining |= 0 // eslint-disable-line no-bitwise
	const values = new Array(remaining).fill(missing)

	return Object.assign(values.map((_, i) => (value) => {
		const prev = values[i]
		values[i] = value
		if (prev !== missing) return
		if (--remaining === 0) {
			const func = callback
			callback = undefined
			func(values)
		}
	}), {
		empty: remaining ? undefined : () => {
			const func = callback
			if (func) { callback = undefined; func(values) }
		},
	})
}

export function create(callback) {
	let remaining = 0
	const values = Object.create(null)
	const refs = Object.create(null)

	return (key) => {
		if (refs[key] != null) return refs[key]
		remaining++
		values[key] = missing
		return refs[key] = (value) => {
			const prev = values[key]
			values[key] = value
			if (prev !== missing) return
			if (--remaining === 0) {
				const func = callback
				callback = undefined
				func(values)
			}
		}
	}
}

export function proxy(callback) {
	const ref = create(callback)
	return new Proxy(Object.create(null), {
		get: (_, key) => ref(key)
	})
}
