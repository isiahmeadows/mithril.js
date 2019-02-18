//model

const state = {
	todos: JSON.parse(localStorage["todos-mithril"] || "[]"),
	editing: null,
}

const subscribers = []
let awaitingFrame = false

export function dispatch(action) {
	switch (action.type) {
	case "createTodo":
		state.todos.push({title: action.title.trim(), completed: false})
		break

	case "setStatuses":
		for (const todo of state.todos) todo.completed = action.completed
		break

	case "setStatus":
		action.todo.completed = action.completed
		break

	case "destroy": {
		const index = state.todos.indexOf(action.todo)
		if (index > -1) state.todos.splice(index, 1)
		break
	}

	case "clear": {
		let count = 0
		for (var i = 0; i < state.todos.length; i++) {
			if (!state.todos[i].completed) state.todos[count++] = state.todos[i]
		}
		state.todos.length = count
		break
	}

	case "edit":
		state.editing = action.todo
		break

	case "update":
		if (state.editing != null) {
			state.editing.title = action.title.trim()
			if (state.editing.title === "") state.destroy(state.editing)
			state.editing = null
		}
		break

	case "reset":
		state.editing = null
		break
	}

	if (awaitingFrame) return
	awaitingFrame = true
	requestAnimationFrame(() => {
		localStorage["todos-mithril"] = JSON.stringify(state.todos)
		awaitingFrame = false
	})

	for (const subscriber of subscribers) subscriber()
}

export function subscribe(f) {
	subscribers.push(f)
}

export function countRemaining() {
	return getTodosByStatus("active").length
}

export function hasRemaining() {
	return state.todos.some(todos => !todo.completed)
}

export function getTodosByStatus(showing) {
	switch (showing) {
	case "all": return state.todos
	case "active": return state.todos.filter(todos => !todo.completed)
	case "completed": return state.todos.filter(todos => todo.completed)
	}
}
