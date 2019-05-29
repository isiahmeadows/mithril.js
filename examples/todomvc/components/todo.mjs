import * as State from "./model.mjs"
import {m, pure} from "../../../mithril/m.mjs"

export default pure(({state, todo}) => {
	let input

	function inputRef(elem) {
		input = elem
		if (
			todo === state.editing &&
			input !== document.activeElement
		) {
			input.focus()
			input.value = todo.title
			input.selectionStart = todo.title.length
			input.selectionEnd = todo.title.length
		}
	}

	function receiver(ev) {
		if (ev.type === "click") {
			if (ev.target.tagName === "input") {
				const completed = !todo.completed
				State.dispatch({type: "setStatus", todo, completed})
			} else {
				State.dispatch({type: "destroy", todo})
			}
		} else if (ev.type === "dblclick") {
			State.dispatch({type: "edit", todo})
		} else if (ev.type === "keyup" || ev.type === "blur") {
			if (ev.keyCode === 13 || ev.type === "blur") {
				State.dispatch({type: "update", title: input.value})
			} else if (ev.keyCode === 27) {
				State.dispatch({type: "reset"})
			}
		}
	}

	return m("li", {
		class: (todo.completed ? "completed" : "") + " " +
			(todo === state.editing ? "editing" : ""),
	}, [
		m("div.view", [
			m("input.toggle[type=checkbox]", {
				checked: todo.completed,
				on: [receiver, "click"],
			}),
			m("label", {on: [receiver, "dblclick"]}, todo.title),
			m("button.destroy", {on: [receiver, "click"]}),
		]),
		m("input.edit", {on: [receiver, "keyup", "blur"], ref: inputRef}),
	])
})
