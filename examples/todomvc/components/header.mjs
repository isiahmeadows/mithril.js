import * as State from "./model.mjs"
import {m} from "../../../mithril/m.mjs"

export default function Header() {
	function receiver(ev) {
		if (ev.keyCode === 13 && ev.target.value) {
			State.dispatch({type: "createTodo", title: ev.target.value})
			ev.target.value = ""
		}
	}
	return m("header.header", [
		m("h1", "todos"),
		m("input#new-todo[placeholder='What needs to be done?'][autofocus]", {
			on: [receiver, "keypress"],
		}),
	])
}
