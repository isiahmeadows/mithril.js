// This is equivalent to `./state.mjs`, but without all the optimizations.
// It also uses ES2019's `Object.fromEntries` for simplicity
function mapValues(object, func) {
	return Object.fromEntries(
		Object.entries(object).map(([k, v]) => [k, func(v, k)])
	)
}

function joinDones(dones) {
	return () => dones.forEach((done) => done())
}

export function join(reducers, func) {
	if (typeof func !== "function") func = (x) => x
	return ({context, state = mapValues(reducers, () => null)}) => {
		const results = mapValues(reducers, (reducer, key) => {
			const update = (value) => state = {...state, [key]: value}
			return reducer({
				isSerializing: () => context.isSerializing(),
				update: (value) => context.update(update(value)),
				updateSync: (value) => context.updateSync(update(value)),
			}, state[key])
		})

		const values = mapValues(results, (v) => v.value)
		const refs = mapValues(results, (v) => v.ref)

		return {
			value: func(values, refs), ref: refs,
			state: mapValues(results, (v) => v.state),
			done: joinDones(Object.values(results).map((v) => v.done)),
		}
	}
}

export function all(reducers, func) {
	if (typeof func !== "function") func = (x) => x
	return ({context, state = new Array(reducers.length).fill()}) => {
		const results = reducers.map((reducer, i) => {
			const update = (value) =>
				state = Object.assign([...state], {[i]: value})
			return reducer({
				isSerializing: () => context.isSerializing(),
				update: (value) => context.update(update(value)),
				updateSync: (value) => context.updateSync(update(value)),
			}, state[i])
		})

		return {
			state: results.map((v) => v.state),
			value: func(results.map((v) => v.value)),
			ref: results.map((v) => v.ref),
			done: joinDones(results.map((v) => v.done)),
		}
	}
}

export function run(value, ...funcs) {
	return funcs.reduce((x, f) => f(x), value)
}

export function id() {
	return of
}

export function pipe(...funcs) {
	if (funcs.length === 0) return of
	if (funcs.length === 1) return funcs[0]
	return (param) => (context, state = {
		index: 0,
		states: new Array(funcs.length).fill(),
		dones: new Array(funcs.length).fill(),
	}) => {
		const start = state.index
		let value = param, ref
		state.index = funcs.length

		for (let i = start; i < funcs.length; i++) {
			let stateSet = false
			const set = (value) => {
				stateSet = true
				state.states[i] = value
				if (state.index < i) state.index = i
			}
			const result = (0, funcs[i])(value)({
				isSerializing: () => context.isSerializing(),
				update: (value) => { set(value); context.update() },
				updateSync: (value) => { set(value); context.update() },
			}, state.states[i])

			value = result.value
			if (!stateSet) state.states[i] = result.state
			state.dones[i] =
				typeof result.done === "function" ? result.done : void 0
			if (result.ref != null) ref = result.ref
		}

		return {
			state: {...state, index: 0}, value, ref,
			done: function () {
				for (const done of state.dones) {
					if (done != null) (0, done)()
				}
			},
		}
	}
}

export function map(reducer, func) {
	return (context, state) => {
		const result = reducer(context, state)
		return {...result, value: func(result.value)}
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
	return () => ({value, ref})
}

export function setRef(reducer, ref) {
	return (context, state) => ({...reducer(context, state), ref})
}

export function chain(reducer, func) {
	return (context, state = {
		isInit: true,
		reducerState: undefined, reducerRef: undefined, reducerDone: undefined,
		innerReducer: undefined, innerState: undefined,
	}) => {
		const isInit = state.isInit
		state.isInit = true
		if (isInit) {
			let stateSet = false
			const set = (value) => {
				stateSet = true
				state.isInit = false
				state.reducerState = value
			}
			const result = reducer({
				isSerializing: () => context.isSerializing(),
				update: (value) => { set(value); return context.update() },
				updateSync: (value) => { set(value); return context.update() },
			}, state.reducerState)
			if (!stateSet) state.reducerState = result.state
			state.reducerDone =
				typeof result.done === "function" ? result.done : void 0
			state.reducerRef = result.ref
			state.innerReducer = func(result.value)
		}

		let stateSet = false
		const set = (value) => {
			stateSet = true
			state.isInit = false
			state.reducerState = value
		}

		const result = (0, state.innerReducer)({
			isSerializing: () => context.isSerializing(),
			update: (value) => { set(value); context.update() },
			updateSync: (value) => { set(value); context.update() },
		}, state.innerState)
		if (!stateSet) state.reducerState = result.state
		const innerDone =
			typeof result.done === "function" ? result.done : void 0

		return {
			ref: result.ref != null ? result.ref : state.reducerRef,
			value: result.value,
			state,
			done() {
				if (state.reducerDone != null) (0, state.reducerDone)()
				if (innerDone != null) (0, innerDone)()
			},
		}
	}
}

export function when(test, cons, alt) {
	if (typeof cons !== "function") cons = (x) => x
	if (typeof alt !== "function") alt = (x) => x
	return chain(test, (result, ref) => result ? cons(ref) : alt(ref))
}

export function watch(value, init, compare) {
	if (typeof compare !== "function") compare = (a, b) => a === b
	return (context, state) => {
		if (state != null) {
			if (compare(state.prev, value)) {
				return {state, value, ref: state.ref, done: state.done}
			} else {
				if (state.done != null) (0, state.done)()
			}
		}

		const result = init({
			isSerializing: () => context.isSerializing(),
			update: (value) => context.update({prev: value, ...state}),
			updateSync: (value) => context.update({prev: value, ...state}),
		}, state != null ? state.prev : undefined, value)
		const done = typeof result.done === "function" ? result.done : undefined
		return {
			value: result.value, ref: result.ref, done,
			state: {prev: value, ref: result.ref, done},
		}
	}
}

export function arrayEqual(a, b, compare) {
	if (typeof compare !== "function") compare = (a, b) => a === b
	return a.length === b.length && a.every((x, i) => compare(x, b[i]))
}

export function watchAll(value, init, compare) {
	return watch(value, init, (a, b) => compare(a, b, compare))
}
