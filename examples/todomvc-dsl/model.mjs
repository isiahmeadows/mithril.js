import {lazy, ref, setEnv} from "mithril"

export function useModel(key) {
    const [model, updateModel] = lazy(() => {
        const serialized = localStorage.getItem(key)
        if (!serialized) localStorage.setItem(key, "[]")
        let id = 0
        const todos = []

        if (serialized != null) {
            for (const todo of JSON.parse(serialized)) {
                todos.push(todo)
                if (todo.id >= id) id = todo.id
            }
        }

        return {editing: null, todos, id}
    })

    const saveRequested = ref(false)

    setEnv("dispatch", (updater) => {
        updateModel(updater)
        if (!saveRequested.current) {
            saveRequested.current = true
            requestIdleCallback(() => {
                localStorage.setItem(key, JSON.stringify(model.todos))
                saveRequested.current = false
            })
        }
    })

    return model
}

export function addTodo(title) {
    return ({id, todos, ...rest}) =>
        ({...rest, id: id + 1, todos: [...todos, {
            id,
            title: title.trim(),
            isCompleted: false,
        }]})
}

export function setAllCompleted(isCompleted) {
    return ({todos, ...rest}) => ({
        ...rest,
        todos: todos.map((todo) => ({...todo, isCompleted}))
    })
}

export function clearCompleted() {
    return ({todos, ...rest}) => ({
        ...rest,
        todos: todos.filter((todo) => !todo.isCompleted),
    })
}

export function reset() {
    return (model) => ({...model, editing: null})
}

export function todoCount(state) {
    return state.todos.length
}

export function remainingCount(state) {
    return state.todos.filter((todo) => todo.isCompleted).length
}

export function hasRemaining(state) {
    return state.todos.some((todo) => !todo.isCompleted)
}

export function getTodosByStatus(state, showing) {
    if (showing === "all") {
        return state.todos
    } else if (showing === "active") {
        return state.todos.filter((todo) => !todo.isCompleted)
    } else /* if (showing === "completed") */ {
        return state.todos.filter((todo) => todo.isCompleted)
    }
}

function setKey(todo, key, value) {
    return ({todos, ...rest}) => ({...rest, todos: todos.map((found) =>
        found.id !== todo.id ? found : {...found, [key]: value}
    )})
}

export function destroy(todo) {
    return ({todos, ...rest}) => ({
        ...rest,
        todos: todos.filter((found) => found.id !== todo.id)
    })
}

export function setTitle(todo, title) {
    title = title.trim()
    if (title === "") return destroy(todo)
    return setKey(todo, "title", title)
}

export function setCompleted(todo, isCompleted) {
    return setKey(todo, "isCompleted", isCompleted)
}

export function isEditing(state, todo) {
    return state.editing.id === todo.id
}

export function edit(todo) {
    return (model) => ({...model, editing: todo})
}

export function stopEditing(todo) {
    return (model) => isEditing(model, todo) ? {...model, editing: null} : model
}
