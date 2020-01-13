import {DOM, Router, m, render} from "mithril"
import Home from "./components/Home.jsx"
import Thread from "./components/Thread.jsx"

T.time("Setup")

const router = new Router(DOM)

render("#app", () => router.match("/", {
    "/": () => <Home />,
    "/thread:id": ({id}) => <Thread id={id} />,
}))
