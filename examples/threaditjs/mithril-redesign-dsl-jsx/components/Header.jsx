import {m, useEnv, component} from "mithril"

const demoSource =
    "https://github.com/isiahmeadows/mithril.js/tree/redesign-redux/examples/" +
    "threaditjs/mithril-redesign-vanilla"

export const Header = component(() => <>
    <p class="head_links">
        <a href={demoSource}>Source</a> | {}
        <a href="http://threaditjs.com">ThreaditJS Home</a>
    </p>
    <h2><a>{useEnv().router.linkTo("/")}ThreaditJS: Mithril</a></h2>
</>)
