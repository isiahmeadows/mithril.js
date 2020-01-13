import m from "mithril"
import Header from "./header.jsx"

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
        case "loading": return <h2>Loading</h2>
        case "notFound": return <h2>Not found! Don't try refreshing!</h2>
        case "error": return <h2>Error! Try refreshing.</h2>
        default: return attrs.view(value)
        }
    }

    return {
        onremove: () => controller.abort(),

        view: (vnode) => {
            attrs = vnode.attrs
            return <>
                <Header />
                <div class="main">{pageView()}</div>
            </>
        },
    }
}
