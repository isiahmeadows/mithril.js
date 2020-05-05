import {DOM, route, m, mount, component} from "mithril"
import {View} from "./components/view.mjs"
import * as Model from "./model.mjs"

const App = component(() => {
    const model = Model.useModel("todos-mithril")

    return route(DOM, ({router}) => [
        route("/all", () => m(View, {model, showing: "all"})),
        route("/active", () => m(View, {model, showing: "active"})),
        route("/completed", () => m(View, {model, showing: "completed"})),
        route(null, () => router.set("/"))
    ])
})

mount("#todoapp").render(m(App))
