import {DOM, route, m, render} from "mithril"
import Home from "./components/Home.jsx"
import Thread from "./components/Thread.jsx"

T.time("Setup")

render("#app", () => route(DOM, () => <>
    {route("/", () => <Home />)}
    {route("/thread:id", ({id}) => <Thread id={id} />)}
</>))
