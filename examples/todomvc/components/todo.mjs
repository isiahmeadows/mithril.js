import {m} from "mithril"
import * as Model from "../model.mjs"

const ENTER_KEY = 13
const ESCAPE_KEY = 27

export default function Todo({model, todo}, info, {dispatch}) {
    function toggleCompleted() {
        dispatch(Model.setCompleted(todo, !todo.isCompleted))
    }

    function edit() {
        dispatch(Model.edit(todo))
    }

    function destroy() {
        dispatch(Model.destroy(todo))
    }

    function setTitle(title) {
        dispatch(Model.setTitle(todo, title))
    }

    function stopEditing() {
        dispatch(Model.stopEditing(todo))
    }

    return [
        m("li",
            {class: {
                completed: todo.isCompleted,
                editing: Model.isEditing(model, todo),
            }},
            m("div.view",
                m("input.toggle", {
                    type: "checkbox",
                    checked: todo.isCompleted,
                    onclick: toggleCompleted,
                }),
                m("label", todo.title, {ondblclick: edit}),
                m("button.destroy", {onclick: destroy}),
            ),
            m("input.edit", {
                onkeyup(ev) {
                    if (ev.keyCode === ENTER_KEY) {
                        setTitle(todo, ev.target.value)
                    } else if (ev.keyCode === ESCAPE_KEY) {
                        stopEditing()
                    }
                },
                onblur(ev) {
                    setTitle(todo, ev.target.value)
                    stopEditing()
                },
            }, info.isInit() && m.capture((input) => {
                if (todo.isEditing && input !== document.activeElement) {
                    input.focus()
                    input.value = todo.title
                    input.selectionStart = todo.title.length
                    input.selectionEnd = todo.title.length
                }
            })),
        ),
    ]
}
