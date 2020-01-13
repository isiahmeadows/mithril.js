import m from "mithril"
import Home from "./components/Home.jsx"
import Thread from "./components/Thread.jsx"

T.time("Setup")

m.route(document.getElementById("app"), "/", {
    "/": Home,
    "/thread/:id": Thread,
})
