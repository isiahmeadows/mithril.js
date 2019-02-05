import {mount} from "../../mithril/esm/mount.mjs"
import {Route} from "../../mithril/esm/utils/route.mjs"
import View from "./view.mjs"

mount(document.getElementById("todoapp"), () => m(Route, {
	default: "/all",
	"/all": () => m(View, {showing: "all"}),
	"/active": () => m(View, {showing: "active"}),
	"/completed": () => m(View, {showing: "completed"}),
}))
