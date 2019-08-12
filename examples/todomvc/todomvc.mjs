import {DOM, Router, all, m, map, render} from "../../mithril.mjs"
import View from "./components/view.mjs"
import {state} from "./model.mjs"

function ViewProxy(attrs) {
	return map(all(state, attrs),
		([state, {showing}]) => m(View, {state, showing})
	)
}

render("#todoapp", new Router(DOM).match(
	["/", () => m(ViewProxy, {showing: "all"})],
	["/active", () => m(ViewProxy, {showing: "active"})],
	["/completed", () => m(ViewProxy, {showing: "completed"})]
))
