import {m, linkTo, component} from "mithril"

const demoSource =
    "https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/" +
    "threaditjs/mithril-redesign-vanilla"

export const Header = component(() => [
    m("p.head_links",
        m("a", {href: demoSource}, "Source"), " | ",
        m("a", {href: "http://threaditjs.com"}, "ThreaditJS Home"),
    ),
    m("h2", m("a", linkTo("/"), "ThreaditJS: Mithril")),
])
