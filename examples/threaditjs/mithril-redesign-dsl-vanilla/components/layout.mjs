import {m, component, use} from "mithril"
import {Header} from "./header.mjs"

export const Layout = component(({load, id, view}) => [
    m(Header),
    m("div.main", use(id, load).match({
        pending: () => m("h2", "Loading"),
        complete: (data) => m.state(view, {data}),
        error: (e) => e.status === 404
            ? m("h2", "Not found! Don't try refreshing!")
            : m("h2", "Error! Try refreshing.")
    })),
])
