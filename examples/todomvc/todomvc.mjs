import {m, mount} from "../../../mithril.mjs"
import {Router} from "../../../mithril/router.mjs"
import View from "./view.mjs"
import {subscribe} from "./model.mjs"

function App(attrs, context) {
	subscribe(() => context.update())
	return () => m(Router, {
		default: "/all",
		"/all": (router) => m(View, {showing: "all", router}),
		"/active": (router) => m(View, {showing: "active", router}),
		"/completed": (router) => m(View, {showing: "completed", router}),
	})
}

mount(document.getElementById("todoapp"), () => m(App))
