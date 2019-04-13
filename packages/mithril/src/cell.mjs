var sentinel = {}

function id(x) { return x }

function sameValueZero(a, b) {
	return a === b || Number.isNaN(a) && Number.isNaN(b)
}

function wrapDones(dones) {
	var count = 0
	for (var i = 0; i < dones.length; i++) {
		if (dones[i] != null) dones[count++] = dones[i]
	}
	dones.length = count
	if (count === 0) return undefined
	if (count === 1) return dones[count]
	return function () {
		var error = sentinel

		for (var i = 0; i < dones.length; i++) {
			try {
				if (dones[i] != null) (0, dones[i])()
			} catch (e) {
				error = e
			}
		}

		if (error !== sentinel) throw error
	}
}

function all(cells, func) {
	if (func == null) func = id
	return function (send) {
		function bind(i) {
			return function (value) {
				values[i] = value
				if (values.indexOf(sentinel) < 0) {
					return send(func(values.slice()))
				}
			}
		}

		var values = [], dones = []
		for (var i = 0; i < cells.length; i++) values[i] = sentinel
		for (i = 0; i < cells.length; i++) {
			dones[i] = (0, cells[i])(bind(i))
		}

		return wrapDones(dones)
	}
}

function join(cells, func) {
	if (func == null) func = id
	var keys = Object.keys(cells)
	return all(
		keys.map(function (key) { return cells[key] }),
		function (values) {
			var result = Object.create(null)
			for (var i = 0; i < values.length; i++) result[keys[i]] = values[i]
			return func(result)
		}
	)
}

function run(value) {
	for (var i = 1; i < arguments.length; i++) value = (0, arguments[i])(value)
	return value
}

function map(cell, func) {
	return function (send) {
		return cell(function (value) {
			return send(func(value))
		})
	}
}

function tap(cell, func) {
	return function (send) {
		return cell(function (value) {
			func(value)
			return send(value)
		})
	}
}

function filter(cell, func) {
	return function (send) {
		return cell(function (value) {
			return func(value) ? send(value) : undefined
		})
	}
}

function scan(cell, initial, func) {
	return function (send) {
		var acc = initial
		return cell(function (value) {
			return send(acc = func(acc, value))
		})
	}
}

function scanMap(cell, initial, func) {
	return function (send) {
		var acc = initial
		return cell(function (value) {
			var pair = func(acc, value)
			acc = pair[0]
			return send(pair[1])
		})
	}
}

function reduce(cell, initial, func) {
	return function (send) {
		var acc = initial
		var done = cell(function (value) {
			acc = func(acc, value)
		})
		return function () {
			try { send(acc) } finally { if (done != null) done() }
		}
	}
}

function distinctSimple(cell) {
	return function (send) {
		var acc = sentinel
		return cell(function (value) {
			if (!sameValueZero(acc, value)) send(acc = value)
		})
	}
}

function distinct(cell, compare) {
	if (compare == null) return distinctSimple(cell)
	return function (send) {
		var acc = sentinel
		return cell(function (value) {
			var prev = acc
			acc = value
			return prev === sentinel || compare(prev, value)
				? send(value)
				: undefined
		})
	}
}

function of() {
	var values = []
	for (var i = 0; i < arguments.length; i++) values.push(arguments[i])
	return function (send) {
		for (var i = 0; i < values.length; i++) send(values[i])
	}
}

function merge() {
	var cells = []
	for (var i = 0; i < arguments.length; i++) cells.push(arguments[i])
	return function () {
		var dones = []
		for (var i = 0; i < cells.length; i++) {
			dones[i] = (0, cells[i]).apply(undefined, arguments)
		}
		return wrapDones(dones)
	}
}

function NEVER() {}

function chain(cell, func) {
	return function () {
		var args = []
		for (var i = 0; i < arguments.length; i++) args[i] = arguments[i]
		var innerDone
		var cellDone = cell(function (value) {
			if (innerDone != null) innerDone()
			innerDone = func(value).apply(undefined, args)
		})

		return function () {
			try {
				if (cellDone != null) cellDone()
			} finally {
				if (innerDone != null) innerDone()
			}
		}
	}
}

function onDone(cell, func) {
	return function () {
		var cellDone = cell.apply(undefined, arguments)
		return function () {
			try {
				if (func != null) func()
			} finally {
				if (cellDone != null) cellDone()
			}
		}
	}
}

function shallowEqual(a, b, compare) {
	if (compare == null) compare = sameValueZero

	if (Array.isArray(a) !== Array.isArray(b)) return false
	if (Array.isArray(a)) {
		if (a.length !== b.length) return false
		for (var i = 0; i < a.length; i++) {
			if (!compare(a[i], b[i])) return false
		}
		return true
	} else {
		var keys = Object.keys(a)
		if (keys.length !== Object.keys(b).length) return false
		for (i = 0; i < keys.length; i++) {
			if (!compare(a[keys[i]], b[keys[i]])) return false
		}
		return true
	}
}

export {
	all, chain, distinct, filter, join, map, merge, NEVER, of, onDone, reduce,
	run, scan, scanMap, shallowEqual, tap,
}
