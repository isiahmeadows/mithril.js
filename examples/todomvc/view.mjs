// view
import {map} from "../../mithril/stream.mjs"
import * as Router from "../../mithril/router.mjs"
import * as State from "./model.mjs"
import {m} from "../../../mithril/m.mjs"

function Header() {
	return m("header.header", [
		m("h1", "todos"),
		m("input#new-todo[placeholder='What needs to be done?'][autofocus]", {
			onkeypress(ev) {
				if (ev.keyCode === 13 && ev.target.value) {
					State.dispatch("createTodo", {title: ev.target.value})
					ev.target.value = ""
				}
			},
		}),
	])
}

function Todo(attrs) {
	return (render, context) => attrs(({todo}) => {
		let input

		if (todo === State.state.editing) {
			context.scheduleLayout(() => {
				if (input !== document.activeElement) {
					input.focus()
					input.selectionStart = todo.title.length
					input.selectionEnd = todo.title.length
				}
			})
		}

		function save(ev) {
			if (ev.keyCode === 13 || ev.type === "blur") {
				State.dispatch("update", {title: input.value})
			} else if (ev.keyCode === 27) {
				State.dispatch("reset")
			}
		}

		render(m("li", {
			class: (todo.completed ? "completed" : "") + " " +
				(todo === State.state.editing ? "editing" : "")
		}, [
			m("div.view", [
				m("input.toggle[type=checkbox]", {
					checked: todo.completed,
					onclick() {
						State.dispatch("setStatus", {
							todo, completed: !todo.completed,
						})
					},
				}),
				m("label", {ondblclick() {
					State.dispatch("edit", {todo})
				}}, todo.title),
				m("button.destroy", {onclick() {
					State.dispatch("destroy", {todo})
				}}),
			]),
			m("input.edit", {
				ref: (elem) => input = elem,
				value: todo.title,
				onkeyup: save, onblur: save,
			}),
		]))
	})
}

function Todos(attrs) {
	return m("section#main", [
		m("input#toggle-all[type=checkbox]", {
			checked: !State.hasRemaining(),
			onchange(ev) {
				State.dispatch("setStatuses", {completed: ev.target.checked})
			},
		}),
		m("label[for=toggle-all]", "Mark all as complete"),
		m("ul#todo-list", m("#keyed", map(attrs, ({showing}) =>
			State.getTodosByStatus({showing}).map((todo) =>
				m(Todo, {key: todo.id, todo})
			)
		))),
	])
}

function Footer(attrs) {
	const remaining = State.countRemaining()

	return [
		m("span#todo-count", [
			m("strong", remaining),
			remaining === 1 ? " item left" : " items left",
		]),
		m("ul#filters", map(attrs, ({showing}) => {
			function filter(href, label, children) {
				return m("li", m(Router.Link, m("a", {
					href, children,
					class: showing === label ? "selected" : ""
				})))
			}

			return [
				filter("/", "all", "All"),
				filter("/active", "active", "Active"),
				filter("/completed", "completed", "Completed"),
			]
		})),
		m("button#clear-completed", {
			onclick() { State.dispatch("clear") }
		}, "Clear completed"),
	]
}

export default function View(attrs) {
	return [
		m(Header),
		State.state.todos.length ? map(attrs, ({showing}) => [
			m(Todos, {showing}),
			m(Footer, {showing}),
		]) : null
	]
}
