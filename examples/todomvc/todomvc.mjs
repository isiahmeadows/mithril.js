import {m, render} from "../../mithril.mjs"
import {match, r} from "../../mithril/router.mjs"
import View from "./components/view.mjs"
import {subscribe} from "./model.mjs"

function ViewProxy({showing}) {
	return (o) => subscribe((state) => o.next(m(View, {state, showing})))
}

render("#todoapp", match({default: "/"}, [
	r("/", () => m(ViewProxy, {showing: "all"})),
	r("/active", () => m(ViewProxy, {showing: "active"})),
	r("/completed", () => m(ViewProxy, {showing: "completed"})),
]))
