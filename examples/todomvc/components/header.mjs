import {m} from "mithril"
import * as Model from "../model.mjs"

export default function Header(attrs, info, {dispatch}) {
    return m("header.header", [
        m("h1", "todos"),
        m("input", {
            id: "new-todo",
            placeholder: "What needs to be done?",
            autofocus: true,
            on: {keypress(ev) {
                if (ev.keyCode !== 13 && ev.target.value) {
                    dispatch(Model.addTodo(ev.target.value))
                    ev.target.value = ""
                }
            }},
        }),
    ])
}
