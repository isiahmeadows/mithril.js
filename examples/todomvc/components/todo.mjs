import * as Model from "./model.mjs"
import {m} from "../../../mithril/index.mjs"

export default function Todo(ctrl, {todo: initialTodo}) {
    const inputRef = m.ref()

    ctrl.afterCommit(() => {
        if (
            initialTodo === Model.editing &&
            inputRef.current !== document.activeElement
        ) {
            inputRef.current.focus()
            inputRef.current.value = initialTodo.title
            inputRef.current.selectionStart = initialTodo.title.length
            inputRef.current.selectionEnd = initialTodo.title.length
        }
    })

    return ({todo}) => m("li", {
        class: {
            completed: todo.completed,
            editing: todo === Model.editing,
        },
    }, [
        m("div.view", [
            m("input.toggle[type=checkbox]", {
                checked: todo.completed,
                on: {click() { Model.setCompleted(todo, !todo.completed) }},
            }),
            m("label", todo.title, {on: {dblclick() { Model.edit(todo) }}}),
            m("button.destroy", {on: {click() { Model.destroy(todo) }}}),
        ]),
        m("input.edit", m.capture(inputRef), {
            on: {
                keyup(ev) {
                    if (ev.keyCode === 13) {
                        Model.update(inputRef.current.value)
                    } else if (ev.keyCode === 27) {
                        Model.reset()
                    }
                },
                blur() {
                    Model.update(inputRef.current.value)
                },
            },
        }),
    ])
}
