import {map, store} from "../../mithril/stream.mjs"

function destroy(todos, todo) {
	return todos.filter((t) => t !== todo)
}

const initialTodos = JSON.parse(localStorage["todos-mithril"] || "[]")
const initialState = {
	todos: initialTodos,
	id: Math.max(-1, ...initialTodos.map((t) => t.id)) + 1,
	editing: null,
}

const [state, update] = store(initialState, ({todos, id, editing}, args) => {
	switch (args.type) {
		case "createTodo":
			return {...state, id: state.id + 1, todos: [
				...state.todos,
				{id: state.id, title: args.title.trim(), completed: false}
			]}

		case "setStatuses":
			return {editing, id, todos: todos.map(({title, id}) =>
				({title, id, completed: args.completed})
			)}

		case "setStatus":
			return {editing, id, todos: todos.map((t) =>
				t.id === args.todo.id ? {...t, completed: args.completed} : t
			)}

		case "destroy":
			return {editing, id, todos: destroy(todos, args.todo)}

		case "clear":
			return {editing, id, todos: todos.filter((t) => !t.completed)}

		case "edit":
			return {todos, id, editing: args.todo}

		case "update":
			if (editing == null) {
				editing.title = args.title.trim()
				if (editing.title === "") {
					return {editing: null, id, todos: destroy(todos, args.todo)}
				}
			}
			return {todos, id, editing: null}

		case "reset":
			return {todos, id, editing: null}

		default:
			throw new TypeError(`Unknown dispatch type: ${args.type}`)
	}
})

export function dispatch(type, action) {
	update({type, ...action})
}

let awaitingFrame = false
map(state, ({todos}) => {
	if (awaitingFrame) return
	awaitingFrame = true
	requestIdleCallback(() => {
		localStorage["todos-mithril"] = JSON.stringify(todos)
		awaitingFrame = false
	})
})()

export function subscribe(f) {
	return state({next: f})
}

export function countRemaining(state) {
	return getTodosByStatus(state, "active").length
}

export function hasRemaining(state) {
	return state.todos.some((todo) => !todo.completed)
}

export function getTodosByStatus({todos}, showing) {
	switch (showing) {
		case "all": return todos
		case "active": return todos.filter((todo) => !todo.completed)
		case "completed": return todos.filter((todo) => todo.completed)
	}
}
