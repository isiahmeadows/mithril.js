import {m, component, useEnv} from "mithril"
import Todo from "./todo.mjs"
import * as Model from "../model.mjs"

export const TodoList = component(({showing, model}) => {
    const {dispatch} = useEnv()

    function setAllCompleted(isCompleted) {
        dispatch(Model.setAllCompleted(isCompleted))
    }

    return m("section", {id: "main"}, [
        m("input", {
            id: "toggle-all",
            type: "checkbox",
            checked: !Model.hasRemaining(model),
            on: {change(ev) { setAllCompleted(ev.target.checked) }},
        }),
        m("label", {for: "toggle-all"}, "Mark all as complete"),
        m("ul", {id: "todo-list"}, m.each(
            Model.getTodosByStatus(model, showing), "id",
            (todo) => m(Todo, {model, todo})
        )),
    ])
})
