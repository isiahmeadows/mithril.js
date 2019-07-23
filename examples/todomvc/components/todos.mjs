import * as State from "./model.mjs"
import {keyed, m, pure} from "../../../mithril/index.mjs"
import Todo from "./todo.mjs"

export default pure(({state, showing}) => {
	const shownTodos = State.getTodosByStatus(state, {showing})
	return m("section#main", [
		m("input#toggle-all[type=checkbox]", {
			checked: !State.hasRemaining(state),
			onchange(ev) {
				State.dispatch({
					type: "setStatuses",
					completed: ev.target.checked
				})
			},
		}),
		m("label[for=toggle-all]", "Mark all as complete"),
		m("ul#todo-list", keyed(shownTodos, "id",
			(todo) => m(Todo, {state, todo})
		)),
	])
})
