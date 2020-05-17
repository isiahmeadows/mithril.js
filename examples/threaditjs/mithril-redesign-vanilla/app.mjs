import {DOM, route, m, render} from "mithril"
import Home from "./components/home.mjs"
import Thread from "./components/thread.mjs"

T.time("Setup")

render("#app", () => route(DOM, () => [
    route("/", () => m(Home)),
    route("/thread:id", ({id}) => m(Thread, {id})),
]))
