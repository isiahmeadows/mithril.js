import m from "mithril"

const demoSource =
    "https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/" +
    "threaditjs/mithril-v2-jsx"

export default {
    view: () => <>
        <p class="head_links">
            <a href={demoSource("mithril-v2")}>Source</a> | {""}
            <a href="http://threaditjs.com">ThreaditJS Home</a>
        </p>
        <h2>
            <m.route.Link href="/">ThreaditJS: Mithril</m.route.Link>
        </h2>
    </>,
}
