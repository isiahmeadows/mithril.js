import {m, render} from "../../../mithril.mjs"
import Router from "../../../mithril/router.mjs"
import View from "./view.mjs"
import {subscribe} from "./model.mjs"

render(document.getElementById("todoapp"), (context) => {
	subscribe(() => context.update())
	return Router.match({
		default: "/all",
		"/": () => m(View, {showing: "all"}),
		"/active": () => m(View, {showing: "active"}),
		"/completed": () => m(View, {showing: "completed"}),
	})
})
