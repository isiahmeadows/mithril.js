import {DOM, route, m, mount} from "mithril"
import View from "./components/view.mjs"
import * as Model from "./model.mjs"

function App(_, info) {
    if (info.isInitial()) {
        info.state = Model.create("todos-mithril", (next) => {
            info.state.model = next
            info.redraw()
        })
    }

    const {model, dispatch} = info.state
    info.set("dispatch", dispatch)

    return route(DOM, ({router}) => [
        route("/all", () => m(View, {model, showing: "all"})),
        route("/active", () => m(View, {model, showing: "active"})),
        route("/completed", () => m(View, {model, showing: "completed"})),
        route(null, () => router.set("/"))
    ])
}

mount("#todoapp").render(m(App))
