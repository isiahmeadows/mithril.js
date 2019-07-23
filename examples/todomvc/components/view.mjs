import {m, pure} from "../../../mithril/index.mjs"
import Footer from "./footer.mjs"
import Header from "./header.mjs"
import Todos from "./todos.mjs"

export default pure(({state, showing}) => [
	m(Header),
	state.todos.length ? [
		m(Todos, {state, showing}),
		m(Footer, {state, showing}),
	] : null,
])
