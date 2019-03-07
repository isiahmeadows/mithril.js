// This is highly optimized to minimize retained and allocated memory.
var hasOwn = Object.prototype.hasOwnProperty
var hole = {}

function makeResult(state, value, ref, done) {
	return {state: state, value: value, ref: ref, done: done}
}

function makeData(context, state) {
	return {c: context, s: state}
}

function makeWatchState(value) {
	return {p: value, d: void 0, i: 0, v: void 0, r: void 0}
}

function joinDones(dones) {
	return function () {
		for (var i = 0; i < dones.length; i++) (0, dones[i])()
	}
}

// Note:
// `context._t === 0`: Join
// `context._t === 1`: All
// `context._t === 2`: Pipe
// `context._t === 3`: Chain
// `context._t === 4`: Chain Inner
// `context._t === 5`: Watch

function Context(type, data, index) {
	this._t = type
	this._d = data
	this._i = index
}

function contextSet(context, value) {
	if (context._t === 0) {
		// `Object.assign` is heavily optimized by engines, so we just use that.
		this._d.s = Object.assign({}, this._d.s)
		this._d.s[this._d.e[this._i]] = value
	} else if (context._t === 1) {
		this._d.s = this._d.s.slice()
		this._d.s[this._i] = value
	} else if (context._t === 2) {
		this._d.s[this._i] = value
		if (this._d.i < this._i) this._d.i = this._i
	} else if (context._t === 3) {
		this._d.s.S = value
	} else if (context._t === 4) {
		this._d.s.s = value
	} else if (context._t === 5) {
		this._d.s.i = 1
	} else {
		throw new TypeError("Unknown context type: " + context._t)
	}
}

Context.prototype.isSerializing = function () {
	return this._d.c.isSerializing()
}

Context.prototype.update = function (value) {
	contextSet(value)
	return this._d.c.update()
}

Context.prototype.updateSync = function (value) {
	contextSet(value)
	return this._d.c.updateSync()
}

export function join(reducers) {
	var keyValuePairs = []

	for (var key in reducers) {
		if (hasOwn.call(reducers, key)) {
			keyValuePairs.push(key)
			keyValuePairs.push(reducers[key])
		}
	}

	return function (context, state) {
		if (state == null) {
			state = {s: {}, e: keyValuePairs}
			for (var i = 0; i < state.e.length; i += 2) {
				state.s[state.e[i]] = void 0
			}
		}

		var data = makeData(context, state)
		var dones = []
		var values = {}
		var refs = {}

		for (i = 0; i < state.e.length; i += 2) {
			values[state.e[i]] = void 0
			refs[state.e[i]] = void 0
		}

		for (i = 0; i < state.e.length; i += 2) {
			var childContext = new Context(0, data, i)
			var child = (0, state.e[i + 1])(childContext, state.s[state.e[i]])

			state.s[state.e[i]] = child.state
			values[state.e[i]] = child.value
			refs[state.e[i]] = child.ref
			if (typeof child.done === "function") dones.push(child.done)
		}

		return makeResult(state, values, refs, joinDones(dones))
	}
}

export function all(reducers, func) {
	if (typeof func !== "function") func = void 0
	return function (context, state) {
		if (state == null) state = new Array(reducers.length).fill()
		var data = makeData(context, state)
		var dones = new Array(reducers.length).fill()
		var values = new Array(reducers.length).fill()
		var refs = new Array(reducers.length).fill()

		for (var i = 0; i < reducers.length; i++) {
			var childContext = new Context(1, data, i)
			var child = (0, reducers[i])(childContext, state[i])

			state[i] = child.state
			values[i] = child.value
			refs[i] = child.ref
			dones[i] = child.done
		}

		var count = 0

		for (i = 0; i < dones.length; i++) {
			if (typeof dones[i] === "function") dones[count++] = dones[i]
		}

		if (func != null) values = func(values)

		return makeResult(state, values, refs, joinDones(dones))
	}
}

export function run(value) {
	for (var i = 1; i < arguments.length; i++) value = (0, arguments[i])(value)
	return value
}

export function id() {
	return of
}

function makePipeState(index, states, dones) {
	return {i: index, s: states, d: dones}
}

export function pipe(a) {
	if (arguments.length === 0) return of
	if (arguments.length === 1) return a
	var funcs = []
	for (var i = 0; i < arguments.length; i++) funcs[i] = arguments[i]
	return function (param) {
		return function (context, state) {
			if (state == null) {
				state = makePipeState(
					0,
					new Array(funcs.length).fill(),
					new Array(funcs.length).fill()
				)
			}
			var index = state.i
			var data = makeData(context, state)
			var value = param, ref
			state.i = funcs.length

			while (index != funcs.length) {
				var prev = state.s[index]
				state.s[index] = hole
				var childContext = new Context(2, data, index)
				var result = (0, funcs[index])(value)(childContext, prev)
				value = result.value
				if (state.s[index] === hole) state.s[index] = result.state
				if (result.ref != null) ref = result.ref
				state.d[index] =
					typeof result.done === "function" ? result.done : void 0
				index++
			}

			// Return a clone, so this receives the correct state when updated
			// externally.
			var clone = makePipeState(0, state.s, state.d)
			return makeResult(clone, value, ref, function () {
				for (var i = 0; i < state.d.length; i++) {
					if (state.d[i] != null) (0, state.d[i])()
				}
			})
		}
	}
}

export function map(reducer, func) {
	return function (context, state) {
		var result = reducer(context, state)
		return makeResult(
			result.state, func(result.value), result.ref, result.done
		)
	}
}

export function tap(reducer, func) {
	return (context, state) => {
		const result = reducer(context, state)
		func(result.value)
		return result
	}
}

export function of(value, ref) {
	return function () {
		return makeResult(void 0, value, ref, void 0)
	}
}

export function setRef(reducer, ref) {
	return function (context, state) {
		var result = reducer(context, state)
		return makeResult(
			result.state, result.value, ref, result.done
		)
	}
}

export function chain(reducer, func) {
	return function (context, state) {
		if (state == null) {
			state = {S: hole, R: void 0, D: void 0, r: void 0, s: hole}
		}
		var data = makeData(context, state)

		if (state.S === hole) {
			state.R = state.D = state.r = void 0
			var parent = reducer(new Context(3, data, 0), state.S)
			if (state.S === hole) state.S = parent.state
			state.D = typeof parent.done === "function" ? parent.done : void 0
			state.R = parent.ref
			state.r = func(parent.value)
		}

		state.s = hole
		var child = (0, state.r)(new Context(4, data, 0), state.s)
		if (state.s === hole) state.S = child.state
		var childDone = typeof child.done === "function" ? child.done : void 0

		return makeResult(
			state, child.value, child.ref != null ? child.ref : state.R,
			function () {
				if (state.D != null) (0, state.D)()
				if (childDone != null) childDone()
			}
		)
	}
}

export function when(test, cons, alt) {
	if (typeof cons !== "function") cons = void 0
	if (typeof alt !== "function") alt = void 0
	return chain(test, function (result) {
		if (result) {
			return cons != null ? cons() : void 0
		} else {
			return alt != null ? alt() : void 0
		}
	})
}

// Faster, smaller closure that avoids dynamic dispatch and extra branching when
// comparing values.
function watchFast(value, init) {
	return function (context, state) {
		var result = makeResult(value, state, void 0, void 0)
		var prev
		if (state != null) {
			prev = state.p
			state.p = value
			var func = state.d
			if (state.i || prev === value) {
				state.i = 0
				result.value = state.v
				result.done = func
				return result
			}
			state.d = state.v = void 0
			if (func != null) { state.d = void 0; func() }
		} else {
			state = result.state = makeWatchState(value)
		}

		var child = new Context(5, makeData(context, state), 0)
		var initResult = init(child, prev, value)
		result.value = state.v = initResult.value
		if (typeof initResult.done === "function") {
			result.done = state.d = initResult.done
		}
		return result
	}
}

export function watch(value, init, compare) {
	if (typeof compare !== "function") return watchFast(value, init)
	return function (context, state) {
		var result = makeResult(value, state, void 0, void 0)
		var prev
		if (state != null) {
			prev = state.p
			state.p = value
			var func = state.d
			if (state.i || compare(prev, value)) {
				state.i = 0
				result.value = state.v
				result.ref = state.r
				result.done = func
				return result
			}
			state.d = state.v = state.r = void 0
			if (func != null) func()
		} else {
			state = result.state = makeWatchState(value)
		}

		var child = new Context(5, makeData(context, state), 0)
		var initResult = init(child, prev, value)
		result.value = state.v = initResult.value
		result.ref = state.r = initResult.ref
		if (typeof initResult.done === "function") {
			result.done = state.d = initResult.done
		}
		return result
	}
}

export function arrayEqual(a, b, compare) {
	var length = a.length, i
	if (length !== b.length) return false
	if (typeof compare === "function") {
		for (i = 0; i !== length; i++) if (a[i] !== b[i]) return false
	} else {
		for (i = 0; i !== length; i++) if (!compare(a[i], b[i])) return false
	}
	return true
}

export function watchAll(value, init, compare) {
	if (typeof compare === "function") {
		return watch(value, init, function (a, b) {
			return compare(a, b, compare)
		})
	} else {
		return watch(value, init, arrayEqual)
	}
}
