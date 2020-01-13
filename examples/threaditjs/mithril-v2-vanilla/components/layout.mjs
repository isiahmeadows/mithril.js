import m from "mithril"
import Header from "./header.mjs"

export default function Layout({attrs}) {
    const controller = new AbortController()
    let state = "loading"
    let value

    attrs.load(controller.signal)
        .then(
            (response) => { state = "ready"; value = response },
            (e) => { state = e.status === 404 ? "notFound" : "error" }
        )
        .finally(m.redraw)

    function pageView() {
        switch (state) {
        case "loading": return m("h2", "Loading")
        case "notFound": return m("h2", "Not found! Don't try refreshing!")
        case "error": return m("h2", "Error! Try refreshing.")
        default: return attrs.view(value)
        }
    }

    return {
        onremove: () => controller.abort(),

        view: (vnode) => {
            attrs = vnode.attrs
            return [
                m(Header),
                m(".main", pageView()),
            ]
        },
    }
}
