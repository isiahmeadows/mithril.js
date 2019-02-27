import {Keyed, m} from "../../../mithril.mjs"
import {
	countRemaining, dispatch, getTodosByStatus, hasRemaining,
	state
} from "./model.mjs"
import {Link} from "../../../mithril/router.mjs"

//view
function Header() {
	return m("header.header", [
		m("h1", "todos"),
		m("input#new-todo[placeholder='What needs to be done?'][autofocus]", {
			onkeypress(e) {
				if (e.keyCode === 13 && e.target.value) {
					dispatch({type: "createTodo", title: e.target.value})
					e.target.value = ""
				}
			},
		}),
	])
}

function Todo({todo}, context, activated = false) {
	function save(ev) {
		if (ev.keyCode === 13 || ev.type === "blur") {
			dispatch({type: "update", title: ev.target.value})
		} else if (ev.keyCode === 27) {
			dispatch({type: "reset"})
		}
	}

	const inputRef = !activated && todo === state.editing
		? (input) => {
			if (input !== document.activeElement) {
				input.focus()
				input.selectionStart = todo.title.length
				input.selectionEnd = todo.title.length
			}
		}
		: undefined

	return m("li", {
		class: (todo.completed ? "completed" : "") + " " +
			(todo === state.editing ? "editing" : "")
	}, [
		m(".view", [
			m("input.toggle[type=checkbox]", {
				checked: todo.completed,
				onclick() {
					dispatch({
						type: "setStatus",
						todo, completed: !todo.completed,
					})
				},
			}),
			m("label", {ondblclick() {
				dispatch({type: "edit", todo})
			}}, todo.title),
			m("button.destroy", {onclick() {
				dispatch({type: "destroy", todo})
			}}),
		]),
		m("input.edit", {
			ref: inputRef, value: todo.title,
			onkeyup: save, onblur: save,
		}),
	])
}

function Todos({showing}) {
	const todosByStatus = getTodosByStatus(showing)

	return m("section#main", [
		m("input#toggle-all[type=checkbox]", {
			checked: !hasRemaining(),
			onchange(ev) {
				dispatch({type: "setStatuses", completed: ev.target.checked})
			},
		}),
		m("label[for=toggle-all]", "Mark all as complete"),
		m("ul#todo-list", m(Keyed, todosByStatus.map((todo) =>
			m(Todo, {key: todo.id, todo})
		))),
	])
}

function Footer({showing}) {
	const remaining = countRemaining()

	return [
		m("span#todo-count", [
			m("strong", remaining),
			remaining === 1 ? " item left" : " items left",
		]),
		m("ul#filters", [
			m("li", m(Link, {
				href: "/all",
				class: showing === "all" ? "selected" : ""
			}, "All")),
			m("li", m(Link, {
				href: "/active",
				class: showing === "active" ? "selected" : ""
			}, "Active")),
			m("li", m(Link, {
				href: "/completed",
				class: showing === "completed" ? "selected" : ""
			}, "Completed")),
		]),
		m("button#clear-completed", {
			onclick() { dispatch({type: "clear"}) }
		}, "Clear completed"),
	]
}

export default function View({showing}) {
	return [
		m(Header),
		state.todos.length ? [
			m(Todos, {showing}),
			m(Footer, {showing}),
		] : null
	]
}
