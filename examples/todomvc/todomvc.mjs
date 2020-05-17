import {DOM, route, m, mount} from "mithril"
import View from "./components/view.mjs"
import * as Model from "./model.mjs"

function App(_, info) {
    const state = info.init(() =>
        Model.create("todos-mithril", (next) => {
            state.model = next
            info.redraw()
        })
    )

    const {model, dispatch} = state
    info.setEnv("dispatch", dispatch)

    return route(DOM, ({router}) => [
        route("/all", () => m(View, {model, showing: "all"})),
        route("/active", () => m(View, {model, showing: "active"})),
        route("/completed", () => m(View, {model, showing: "completed"})),
        route(null, () => router.set("/"))
    ])
}

mount("#todoapp").render(m(App))
