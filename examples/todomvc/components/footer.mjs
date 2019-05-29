import * as State from "./model.mjs"
import {m, pure} from "../../../mithril/m.mjs"
import {Link} from "../../mithril/router.mjs"

export default pure(({state, showing}) => {
	const remaining = State.countRemaining(state)

	function receiver() {
		State.dispatch({type: "clear"})
	}

	function filter(href, label, children) {
		return m("li", m(Link, m("a", {
			href, children,
			class: showing === label ? "selected" : ""
		})))
	}

	return [
		m("span#todo-count", [
			m("strong", remaining),
			remaining === 1 ? " item left" : " items left",
		]),
		m("ul#filters", [
			filter("/", "all", "All"),
			filter("/active", "active", "Active"),
			filter("/completed", "completed", "Completed"),
		]),
		m("button#clear-completed", {
			on: [receiver, "click"],
		}, "Clear completed"),
	]
})
