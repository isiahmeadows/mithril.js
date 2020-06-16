import m from "mithril"

const demoSource =
    "https://github.com/isiahmeadows/mithril.js/tree/redesign-redux/examples/" +
    "threaditjs/mithril-v2-jsx"

export default {
    view: () => [
        m("p.head_links", [
            m("a", {href: demoSource}, "Source"), " | ",
            m("a[href='http://threaditjs.com']", "ThreaditJS Home"),
        ]),
        m("h2", [
            m(m.route.Link, {href: "/"}, "ThreaditJS: Mithril"),
        ]),
    ],
}
