// setup
import * as Router from "../../mithril/router.mjs"
import {m, render} from "../../mithril.mjs"
import View from "./view.mjs"
import {subscribe} from "./model.mjs"

function ViewProxy({showing}) {
	return (o) => {
		subscribe(() => o.next(m(View, {showing})))
		o.next(m(View, {showing}))
	}
}

render("#todoapp", Router.match({
	default: "/",
	"/": () => m(ViewProxy, {showing: "all"}),
	"/active": () => m(ViewProxy, {showing: "active"}),
	"/completed": () => m(ViewProxy, {showing: "completed"}),
}))
