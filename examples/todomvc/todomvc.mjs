//setup
import * as Router from "../../mithril/router.mjs"
import {m, render} from "../../mithril.mjs"
import View from "./view.mjs"
import {subscribe} from "./model.mjs"

render(document.getElementById("todoapp"), (render) => {
	const router = Router.match({
		default: "/",
		"/": () => m(View, {showing: "all"}),
		"/active": () => m(View, {showing: "active"}),
		"/completed": () => m(View, {showing: "completed"}),
	})
	subscribe(() => render(router))
	render(router)
})
