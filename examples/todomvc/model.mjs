export const todos = JSON.parse(localStorage["todos-mithril"] || "[]")
export let editing

let id = Math.max(-1, ...todos.map((t) => t.id)) + 1

let awaitingFrame = false
function persist() {
    if (awaitingFrame) return
    awaitingFrame = true
    requestIdleCallback(() => {
        localStorage["todos-mithril"] = JSON.stringify(todos)
        awaitingFrame = false
    })
}

export function createTodo(title) {
    todos.push({id, title: title.trim(), completed: false})
    id++
    persist()
}

export function setAllCompleted(completed) {
    for (const t of todos) t.completed = completed
    persist()
}

export function setCompleted(todo, completed) {
    todo.completed = completed
    persist()
}

export function destroy(todo) {
    todos.splice(todos.indexOf(todo), 1)
    persist()
}

export function clear() {
    let count = 0
    for (const todo of todos) if (!todo.completed) todos[count++] = todo
    todos.length = count
    persist()
}

export function edit(todo) {
    editing = todo
}

export function update(todo, title) {
    if (editing != null) {
        editing.title = title.trim()
        if (editing.title === "") todos.splice(todos.indexOf(todo), 1)
        editing = null
    }
    persist()
}

export function reset() {
    editing = null
}

export function countRemaining() {
    let count = 0
    for (const todo of todos) count += !todo.completed
    return count
}

export function hasRemaining() {
    return todos.some((todo) => !todo.completed)
}

export function getTodosByStatus(showing) {
    switch (showing) {
        case "all": return todos
        case "active": return todos.filter((todo) => !todo.completed)
        case "completed": return todos.filter((todo) => todo.completed)
    }
}
