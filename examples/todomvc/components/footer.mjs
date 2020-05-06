import {linkTo, m} from "mithril"
import * as Model from "../model.mjs"

export default function Footer({model, showing}, info, {dispatch}) {
    const remaining = Model.remainingCount(model)

    function filter(href, label, children) {
        return m("li", m("a", linkTo(href), children, {
            class: {selected: showing === label},
        }))
    }

    return [
        m("span", {id: "todo-count"}, [
            m("strong", remaining),
            remaining === 1 ? " item left" : " items left",
        ]),
        m("ul", {id: "filters"}, [
            filter("/", "all", "All"),
            filter("/active", "active", "Active"),
            filter("/completed", "completed", "Completed"),
        ]),
        m("button", "Clear completed", {
            id: "clear-completed",
            on: {click() { dispatch(Model.clearCompleted()) }},
        }),
    ]
}
