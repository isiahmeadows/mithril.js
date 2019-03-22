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

function all(cells, func) {
	if (func == null) func = id
	return function (send) {
		var values = cells.map(function () { return sentinel })
		var dones = cells.map(function (cell, i) {
			return cell(function (value) {
				values[i] = value
				if (values.indexOf(sentinel) < 0) {
					return send(func(values.slice()))
				}
			})
		})

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
}

function join(cells, func) {
	if (func == null) func = id
	var keys = Object.keys(cells)
	return all(
		keys.map(function (key) { return cells[key] }),
		function (values) {
			var result = {}
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

function transformFold(cell, initial, consume, wrapDone) {
	return function (send) {
		var acc = initial
		var done = cell(function (value) {
			var result = consume(send, acc, value)
			acc = result.a
			return result.r
		})
		return wrapDone ? wrapDone(send, acc, done) : done
	}
}

function scan(cell, initial, func) {
	return transformFold(cell, initial, function (send, acc, value) {
		return {r: send(value = func(acc, value)), a: value}
	})
}

function scanMap(cell, initial, func) {
	return transformFold(cell, initial, function (send, acc, value) {
		var pair = func(acc, value)
		return {r: send(pair[1]), a: pair[0]}
	})
}

function reduce(cell, initial, func) {
	return transformFold(cell, initial,
		function (send, acc, value) { return {a: func(acc, value)} },
		function (send, acc, done) {
			return function () {
				try { send(acc) } finally { if (done != null) done() }
			}
		}
	)
}

function distinct(cell, compare) {
	if (compare == null) compare = sameValueZero
	return transformFold(cell, undefined, function (send, acc, value) {
		return {r: compare(acc, value) ? send(value) : undefined, a: value}
	})
}

function of(value) {
	return function (send) { send(value) }
}

function chain(cell, func) {
	return function (send) {
		var innerDone
		var cellDone = cell(function (value) {
			if (innerDone != null) innerDone()
			innerDone = func(value)(send)
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
	return function (send) {
		var cellDone = cell(send)
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
else (window.Mithril || (window.Mithril = {})).Cell = Cell
})()
