import * as Model from "./model.mjs"
import Todo from "./todo.mjs"
import {m} from "../../../mithril/index.mjs"

export default function Todos(ctrl, {showing}) {
    return m("section#main", [
        m("input#toggle-all[type=checkbox]", {
            checked: !Model.hasRemaining(),
            on: {change(ev) {
                Model.setAllCompleted(ev.target.checked)
            }},
        }),
        m("label[for=toggle-all]", "Mark all as complete"),
        m("ul#todo-list", m.each(
            Model.getTodosByStatus(showing), "id",
            (todo) => m(Todo, {todo})
        )),
    ])
}
