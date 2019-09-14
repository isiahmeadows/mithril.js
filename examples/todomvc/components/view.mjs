import Footer from "./footer.mjs"
import Header from "./header.mjs"
import Todos from "./todos.mjs"
import {m} from "../../../mithril/index.mjs"
import {todos} from "./model.mjs"

export default function View(ctrl, {showing}) {
    return [
        m(Header),
        todos.length ? [
            m(Todos, {showing}),
            m(Footer, {showing}),
        ] : null,
    ]
}
