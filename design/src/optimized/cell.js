// A global, ES5 equivalent of `src/cell.mjs`, for show and to test for file
// size.
(function () {
// eslint-disable-next-line strict
"use strict"

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

function argsToArray() {
	var args = []
	for (var i = 0; i < arguments.length; i++) args[i] = arguments[i]
	return args
}

function all(cells, func) {
	if (func == null) func = id
	return function (send) {
		var remaining = cells.length
		function bind(i) {
			return function (value) {
				if (values[i] === sentinel) remaining--
				values[i] = value
				if (remaining === 0) {
					return send(func(values.slice()))
				}
			}
		}

		var values = [], dones = []
		for (var i = 0; i < cells.length; i++) values[i] = sentinel
		for (var i = 0; i < cells.length; i++) dones[i] = (0, cells[i])(bind(i))
		return wrapDones(dones)
	}
}

function join(cells, func) {
	if (func == null) func = id
	var keys = Object.keys(cells)
	return function (send) {
		var remaining = keys.length
		function bind(key) {
			return function (value) {
				if (values[key] === sentinel) remaining--
				values[key] = value
				if (remaining === 0) {
					var result = Object.create(null)
					assign(result, values)
					return send(func(result))
				}
			}
		}

		var values = Object.create(null), dones = []
		for (var i = 0; i < keys.length; i++) values[keys[i]] = sentinel
		for (var i = 0; i < keys.length; i++) {
			dones[i] = (0, cells[keys[i]])(bind(keys[i]))
		}
		return wrapDones(dones)
	}
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
	var values = argsToArray.apply(undefined, arguments)
	return function (send) {
		for (var i = 0; i < values.length; i++) send(values[i])
	}
}

function merge() {
	var cells = argsToArray.apply(undefined, arguments)
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
		var args = argsToArray.apply(undefined, arguments)
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
		for (var i = 0; i < keys.length; i++) {
			if (!compare(a[keys[i]], b[keys[i]])) return false
		}
		return true
	}
}

var Cell = {
	all: all,
	chain: chain,
	distinct: distinct,
	filter: filter,
	join: join,
	map: map,
	merge: merge,
	NEVER: NEVER,
	of: of,
	onDone: onDone,
	reduce: reduce,
	run: run,
	scan: scan,
	scanMap: scanMap,
	shallowEqual: shallowEqual,
	tap: tap,
}

if (typeof module !== "undefined" && module.exports) module.exports = Cell
else window.Cell = Cell
})()
