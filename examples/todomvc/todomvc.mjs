import {DOM, Router, m, render} from "../../mithril.mjs"
import View from "./components/view.mjs"

const router = new Router(DOM)
render("#todoapp", () => router.match(
    ["/", () => m(View, {showing: "all"})],
    ["/active", () => m(View, {showing: "active"})],
    ["/completed", () => m(View, {showing: "completed"})]
))
