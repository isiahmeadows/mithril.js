import * as Model from "./model.mjs"
import {m} from "../../../mithril/index.mjs"

export default function Header() {
    return m("header.header", [
        m("h1", "todos"),
        m("input#new-todo[placeholder='What needs to be done?'][autofocus]", {
            on: {keypress(ev) {
                if (ev.keyCode === 13 && ev.target.value) {
                    Model.createTodo(ev.target.value)
                    ev.target.value = ""
                }
            }},
        }),
    ])
}
