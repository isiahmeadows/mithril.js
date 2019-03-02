import {m, render} from "../../../mithril.mjs"
import Router from "../../../mithril/router.mjs"
import View from "./view.mjs"
import {subscribe} from "./model.mjs"

function App(attrs, context) {
	subscribe(() => context.update())
	return () => Router.match({
		default: "/all",
		"/": () => m(View, {showing: "all"}),
		"/active": () => m(View, {showing: "active"}),
		"/completed": () => m(View, {showing: "completed"}),
	})
}

render(document.getElementById("todoapp"), m(App))
