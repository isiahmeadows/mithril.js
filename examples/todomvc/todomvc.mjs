//setup
import {m, render} from "../../../mithril.mjs"
import Router from "../../../mithril/router.mjs"
import View from "./view.mjs"
import {subscribe} from "./model.mjs"

render(document.getElementById("todoapp"), (render) => {
	const update = () => render(Router.match({
		default: "/all",
		"/": () => m(View, {showing: "all"}),
		"/active": () => m(View, {showing: "active"}),
		"/completed": () => m(View, {showing: "completed"}),
	}))
	subscribe(update)
	update()
})
