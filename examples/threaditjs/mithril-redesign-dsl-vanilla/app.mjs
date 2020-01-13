import {DOM, Router, m, render} from "mithril"
import {Home} from "./components/home.mjs"
import {Thread} from "./components/thread.mjs"

T.time("Setup")

const router = new Router(DOM)

render("#app", () => router.match("/", {
    "/": () => m(Home),
    "/thread:id": ({id}) => m(Thread, {id}),
}))
