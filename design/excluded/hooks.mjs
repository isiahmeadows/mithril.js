import createStream from "mithril/stream"

let currentState, currentIndex

export const IGNORE = new Error("Hooks.IGNORE")

function run(state, paramStream) {
	const prevState = currentState, prevIndex = currentIndex
	let ignore = false, result, subscription
	currentState = state; currentIndex = 0
	state.scheduled = undefined
	try {
		result = (0, state.body)(state.param)
	} catch (e) {
		if (e !== IGNORE) throw e
		ignore = true
	} finally {
		state.ready = true
		currentState = prevState; currentIndex = prevIndex
	}
	if (paramStream != null) {
		subscription = paramStream.subscribe((param) => {
			state.param = param
			run(state)
		})
	}
	if (!ignore) (0, state.send)(result)
	return subscription
}

const p = Promise.resolve()

function getScheduled(state) {
	if (state.scheduled != null) return state.scheduled
	const scheduled = state.scheduled = {effects: [], updateView: false}
	function callback() {
		state.scheduled = undefined
		for (const {index, handler} of scheduled.effects) {
			state.slots[index].done = handler()
		}
		if (scheduled.updateView) run(state)
	}
	p.then(callback)
	return scheduled
}

function sameValueZero(a, b) {
	return a === b || Number.isNaN(a) && Number.isNaN(b)
}

function depsAreSame(prev, deps) {
	if (prev == null) return false
	for (let i = 0; i < prev.length; i++) {
		if (!sameValueZero(prev[i], deps[i])) return false
	}
	return true
}

function initHooks(paramStream, body) {
	if (body == null) { body = paramStream; paramStream = undefined }
	return createStream((observer) => {
		const state = {
			param: undefined, slots: [], ready: false, scheduled: undefined,
			observer, body,
		}
		const subscription = run(state, paramStream)
		return () => {
			try {
				for (const {done} of state.slots) {
					if (typeof done === "function") done()
				}
			} finally {
				subscription.unsubscribe()
			}
		}
	})
}

export function withHooks(body) {
	return (attrs) => initHooks(attrs, body)
}

export function useState(initialValue, reducer) {
	if (typeof reducer !== "function") reducer = undefined
	const state = currentState
	const slot = state.ready
		? state.slots[currentIndex++]
		: state.slots[currentIndex++] = {done: undefined, value: initialValue}
	return [slot.value, (value) => {
		slot.value = reducer != null ? reducer(slot.value, value) : value
		getScheduled(state).updateView = true
	}]
}

export function useStateInit(init, reducer) {
	if (typeof reducer !== "function") reducer = undefined
	const state = currentState
	const slot = state.ready
		? state.slots[currentIndex++]
		: state.slots[currentIndex++] = {done: undefined, value: init()}
	return [slot.value, (value) => {
		slot.value = reducer != null ? reducer(slot.value, value) : value
		getScheduled(state).updateView = true
	}]
}

export function useRef(initialValue) {
	return (
		currentState.ready
			? currentState.slots[currentIndex++]
			: currentState.slots[currentIndex++] = {
				done: undefined,
				value: {current: initialValue}
			}
	).value
}

export function useRefInit(init) {
	return (
		currentState.ready
			? currentState.slots[currentIndex++]
			: currentState.slots[currentIndex++] = {
				done: undefined,
				value: {current: init()}
			}
	).value
}

export function useEffect(deps, onUpdate) {
	const state = currentState
	const index = currentIndex++
	const slot = state.ready
		? state.slots[index]
		: state.slots[index] = {done: undefined, value: undefined}
	if (!depsAreSame(slot.value, deps)) {
		slot.value = deps
		getScheduled(state).effects.push({index, handler: onUpdate, deps})
	}
}

export function useMemo(deps, initialValue) {
	return useMemoInit(deps, () => initialValue)
}

export function useMemoInit(deps, init) {
	const state = currentState
	const index = currentIndex++
	const slot = state.ready
		? state.slots[index]
		: state.slots[index] = {
			done: undefined,
			deps: undefined,
			current: undefined
		}
	if (!depsAreSame(slot.deps, deps)) {
		slot.deps = deps
		slot.current = init(deps)
	}
	return slot.current
}

export function useStreamFactory(factory) {
	const state = currentState
	const index = currentIndex++
	const slot = state.ready
		? state.slots[index]
		: state.slots[index] = {
			done: undefined,
			current: undefined,
			factory: undefined,
			observers: undefined,
			sync: undefined,
		}
	if (slot.factory !== factory) {
		slot.factory = factory
		slot.observers = []
		slot.sync = true
		const prev = slot.done
		slot.done = slot
		if (prev != null) prev()
		try {
			const sub = factory(createStream((o) => {
				slot.observers.push(o)
				return () => {
					slot.done = undefined
					slot.observers.splice(slot.observers.indexOf(o), 1)
				}
			})).subscribe({
				next: (value) => {
					slot.current = value
					if (!slot.sync) getScheduled(state).updateView = true
				},
				error: (value) => {
					slot.done = undefined
					console.error(value)
				},
				complete: () => {
					slot.done = undefined
				},
			})
			if (slot.done === slot) slot.done = () => sub.unsubscribe()
		} finally {
			slot.sync = false
		}
	}
	return [slot.current, (value) => {
		for (let i = 0; i < slot.observers.length; i++) {
			slot.observers[i].next(value)
		}
	}]
}

export function useStream(stream) {
	const state = currentState
	const index = currentIndex++
	const slot = state.ready
		? state.slots[index]
		: state.slots[index] = {
			done: undefined,
			current: undefined,
			stream: undefined,
			sync: undefined,
		}
	if (slot.stream !== stream) {
		slot.stream = stream
		slot.sync = true
		const prev = slot.done
		slot.done = slot
		if (prev != null) prev()
		try {
			const sub = stream.subscribe({
				next: (value) => {
					slot.current = value
					if (!slot.sync) getScheduled(state).updateView = true
				},
				error: (value) => {
					slot.done = undefined
					console.error(value)
				},
				complete: () => {
					slot.done = undefined
				},
			})
			if (slot.done === slot) slot.done = () => sub.unsubscribe()
		} finally {
			slot.sync = false
		}
	}
	return slot.current
}

export function useContext() {
	return currentState.context
}
