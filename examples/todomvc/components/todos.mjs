import * as State from "./model.mjs"
import {m, pure} from "../../../mithril/m.mjs"
import Todo from "./todo.mjs"

export default pure(({state, showing}) => {
	function receiver(ev) {
		State.dispatch({type: "setStatuses", completed: ev.target.checked})
	}
	const shownTodos = State.getTodosByStatus(state, {showing})
	return m("section#main", [
		m("input#toggle-all[type=checkbox]", {
			checked: !State.hasRemaining(state),
			on: [receiver, "change"],
		}),
		m("label[for=toggle-all]", "Mark all as complete"),
		m("ul#todo-list", m("#keyed", {of: shownTodos, by: "id"}, [
			(todo) => m(Todo, {state, todo})
		])),
	])
})
