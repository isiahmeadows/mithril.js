import {m} from "mithril"

const demoSource =
    "https://github.com/isiahmeadows/mithril.js/tree/redesign-redux/examples/" +
    "threaditjs/mithril-redesign-vanilla"

export default function Header(attrs, info, {router}) {
    return [
        m("p.head_links",
            m("a", {href: demoSource}, "Source"), " | ",
            m("a", {href: "http://threaditjs.com"}, "ThreaditJS Home"),
        ),
        m("h2", m("a", router.linkTo("/"), "ThreaditJS: Mithril")),
    ]
}
