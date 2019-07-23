import {m, pure} from "../../../mithril/index.mjs"
import {dispatch} from "./model.mjs"

export default pure(({state, todo}) => m("li", {
	class: {
		completed: todo.completed,
		editing: todo === state.editing,
	},
}, [
	m("div.view", [
		m("input.toggle[type=checkbox]", {
			checked: todo.completed,
			onclick() {
				dispatch("setStatus", {todo, completed: !todo.completed})
			}
		}),
		m("label", todo.title, {ondblclick() { dispatch("edit", {todo}) }}),
		m("button.destroy", {onclick() { dispatch("destroy", {todo}) }}),
	]),
	m("input.edit", {
		onkeyup(ev) {
			if (ev.keyCode === 13) {
				dispatch("update", {title: ev.target.value})
			} else if (ev.keyCode === 27) {
				dispatch("reset")
			}
		},
		onblur(ev) {
			dispatch("update", {title: ev.target.value})
		},
		afterCommit(input) {
			if (
				todo === state.editing &&
				input !== document.activeElement
			) {
				input.focus()
				input.value = todo.title
				input.selectionStart = todo.title.length
				input.selectionEnd = todo.title.length
			}
		},
	}),
]))
