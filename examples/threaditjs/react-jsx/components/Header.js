import React from "react"
import {Link} from "react-router"

const demoSource =
    "https://github.com/isiahmeadows/mithril.js/tree/redesign-redux/examples/" +
    "threaditjs/react-hooks"

export default function Header() {
    return <>
        <p className="head_links">
            <a href={demoSource}>Source</a> | {""}
            <a href="http://threaditjs.com">ThreaditJS Home</a>
        </p>
        <h2>
            <Link to="/">ThreaditJS: React</Link>
        </h2>
    </>
}
