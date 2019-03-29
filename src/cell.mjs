// This uses ES2019's `Object.fromEntries` in `join` for simplicity

const sentinel = {}

function sameValueZero(a, b) {
	return a === b || Number.isNaN(a) && Number.isNaN(b)
}

function wrapDones(dones) {
	return () => {
		let error = sentinel

		for (const done of dones) {
			try { if (done != null) done() } catch (e) { error = e }
		}

		if (error !== sentinel) throw error
	}
}

export function all([...cells], func = (x) => x) {
	return (send) => {
		const values = cells.map(() => sentinel)
		return wrapDones(cells.map((cell, i) => cell((value) => {
			values[i] = value
			if (values.includes(sentinel)) return undefined
			return send(func([...values]))
		})))
	}
}

export function join({...cells}, func = (x) => x) {
	const keys = Object.keys(cells)
	return all(keys.map((key) => cells[key]), (values) =>
		func(Object.fromEntries(keys.map((k, i) => [k, values[i]])))
	)
}

export function run(value, ...funcs) {
	return funcs.reduce((x, f) => f(x), value)
}

export function map(cell, func) {
	return (send) => cell((value) => send(func(value)))
}

export function tap(cell, func) {
	return (send) => cell((value) => { func(value); return send(value) })
}

export function filter(cell, func) {
	return (send) => cell((value) => func(value) ? send(value) : undefined)
}

function transformFold(cell, initial, consume, wrapDone) {
	return (send) => {
		var acc = initial
		var done = cell((value) => {
			var result = consume(send, acc, value)
			acc = result.a
			return result.r
		})
		return wrapDone ? wrapDone(send, acc, done) : done
	}
}

export function scan(cell, initial, func) {
	return transformFold(cell, initial, (send, acc, value) =>
		({r: send(value = func(acc, value)), a: value})
	)
}

export function scanMap(cell, initial, func) {
	return transformFold(cell, initial, (send, acc, value) => {
		[acc, value] = func(acc, value)
		return {r: send(value), a: acc}
	})
}

export function reduce(cell, initial, func) {
	return transformFold(cell, initial,
		(send, acc, value) => ({a: func(acc, value)}),
		(send, acc, done) => () => {
			try { send(acc) } finally { if (done != null) done() }
		}
	)
}

export function distinct(cell, compare = sameValueZero) {
	return transformFold(cell, sentinel, (send, acc, value) => ({
		r: acc === sentinel || compare(acc, value) ? send(value) : undefined,
		a: value,
	}))
}

export function of(...values) {
	return (send) => { for (const value of values) send(value) }
}

export function merge(...cells) {
	return (...args) => wrapDones(cells.map((cell) => cell(...args)))
}

export function NEVER() {}

export function chain(cell, func) {
	return (...args) => {
		let innerDone
		const cellDone = cell((value) => {
			if (innerDone != null) innerDone()
			innerDone = func(value)(...args)
		})

		return () => {
			try {
				if (cellDone != null) cellDone()
			} finally {
				if (innerDone != null) innerDone()
			}
		}
	}
}

export function onDone(cell, func) {
	return (...args) => {
		const cellDone = cell(...args)
		return () => {
			try {
				if (func != null) func()
			} finally {
				if (cellDone != null) cellDone()
			}
		}
	}
}

export function shallowEqual(a, b, compare = sameValueZero) {
	if (Array.isArray(a) !== Array.isArray(b)) return false
	if (Array.isArray(a)) {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) {
			if (!compare(a[i], b[i])) return false
		}
		return true
	} else {
		const keys = Object.keys(a)
		if (keys.length !== Object.keys(b).length) return false
		for (const key of keys) if (!compare(a[key], b[key])) return false
		return true
	}
}
