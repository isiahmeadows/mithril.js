let currentState, currentIndex

export const IGNORE = new Error("Hooks.IGNORE")

function run(state, paramCell) {
	const prevState = currentState, prevIndex = currentIndex
	let ignore = false, result
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
	if (paramCell != null) {
		paramCell((param) => {
			state.param = param
			run(state)
		})
	}
	if (!ignore) (0, state.send)(result)
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
	if (state.context != null) {
		state.context.scheduleLayout(callback)
	} else {
		p.then(callback)
	}
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

function initHooks(paramCell, body) {
	if (body == null) { body = paramCell; paramCell = undefined }
	return (send, context) => {
		if (context != null && typeof context !== "object") context = undefined
		const state = {
			param: undefined, slots: [], ready: false, scheduled: undefined,
			body, send, context,
		}
		run(state, paramCell)
		return () => {
			for (const {done} of state.slots) {
				if (typeof done === "function") done()
			}
		}
	}
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

export function useCellFactory(factory) {
	const state = currentState
	const index = currentIndex++
	const slot = state.ready
		? state.slots[index]
		: state.slots[index] = {
			done: undefined,
			current: undefined,
			factory: undefined,
			sends: undefined,
			sync: undefined,
		}
	if (slot.factory !== factory) {
		slot.factory = factory
		slot.sends = []
		slot.sync = true
		try {
			slot.done = factory((send) => {
				slot.sends.push(send)
			})((value) => {
				slot.current = value
				if (!slot.sync) getScheduled(state).updateView = true
			})
		} finally {
			slot.sync = false
		}
	}
	return [slot.current, (value) => {
		for (let i = 0; i < slot.sends.length; i++) {
			(0, slot.sends[i])(value)
		}
	}]
}

export function useCell(cell) {
	const state = currentState
	const index = currentIndex++
	const slot = state.ready
		? state.slots[index]
		: state.slots[index] = {
			done: undefined,
			current: undefined,
			cell: undefined,
			sync: undefined,
		}
	if (slot.cell !== cell) {
		slot.cell = cell
		slot.sync = true
		try {
			slot.done = cell((value) => {
				slot.current = value
				if (!slot.sync) getScheduled(state).updateView = true
			})
		} finally {
			slot.sync = false
		}
	}
	return slot.current
}

export function useContext() {
	return currentState.context
}

export function useRenderInfo(key) {
	return currentState.context.renderInfo[key]
}
