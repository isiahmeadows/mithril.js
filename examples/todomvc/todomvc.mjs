import {mount} from "../../../mithril/mount.mjs"
import {Route} from "../../../mithril/utils/route.mjs"
import View from "./view.mjs"
import {subscribe} from "./model.mjs"

function App(attrs, context, isReady = false) {
	subscribe(() => context.update())
	return () => m(Route, {
		default: "/all",
		"/all": router => m(View, {showing: "all", router}),
		"/active": router => m(View, {showing: "active", router}),
		"/completed": router => m(View, {showing: "completed", router}),
	})
}

mount(document.getElementById("todoapp"), () => )
