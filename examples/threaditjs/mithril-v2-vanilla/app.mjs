import m from "mithril"
import Home from "./components/home.mjs"
import Thread from "./components/thread.mjs"

T.time("Setup")

m.route(document.getElementById("app"), "/", {
    "/": Home,
    "/thread/:id": Thread,
})
