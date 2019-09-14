import * as Model from "./model.mjs"
import {linkTo, m} from "../../../mithril/index.mjs"

export default function Footer(ctrl, {showing}) {
    const remaining = Model.countRemaining()

    function filter(href, label, children) {
        return m("li", m("a", linkTo(href), children, {
            class: {selected: showing === label},
        }))
    }

    return [
        m("span#todo-count", [
            m("strong", remaining),
            remaining === 1 ? " item left" : " items left",
        ]),
        m("ul#filters", [
            filter("/", "all", "All"),
            filter("/active", "active", "Active"),
            filter("/completed", "completed", "Completed"),
        ]),
        m("button#clear-completed", "Clear completed", {
            on: {click() { Model.clear() }},
        }),
    ]
}
