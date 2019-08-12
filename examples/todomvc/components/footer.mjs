import * as State from "./model.mjs"
import {linkTo, m, pure} from "../../../mithril/index.mjs"

export default pure(({state, showing}) => {
	const remaining = State.countRemaining(state)

	function filter(href, label, children) {
		return m("li > a", linkTo(href), children, {
			class: {selected: showing === label},
		})
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
		m("button#clear-completed", "Clear completed", {
			onclick() { State.dispatch({type: "clear"}) },
		}),
	]
})
