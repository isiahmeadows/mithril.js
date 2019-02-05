// Mithril (this): 167 lines. React + experimental Hooks: 210 lines.
// Totals exclude this header comment. Mithril v3 is ~20% smaller.
import {m, mount, fragment, keyed, trust} from "mithril/esm/m"
import {Route, Link} from "mithril/esm/util/route"
import Async from "mithril/esm/util/async"
import request from "mithril/esm/util/request"

T.time("Setup")

//API calls
const apiUrl = ref => T.apiUrl + ref
const api = {
	async home() {
		T.timeEnd("Setup")
		return request(apiUrl("/threads"))
	},
	async thread(id) {
		T.timeEnd("Setup")
		return T.transformResponse(
			await request(apiUrl("/comments/:id"), {params: {id}})
		)
	},
	async newThread(text) {
		return request(apiUrl("/threads/create"), {
			method: "POST",
			params: {text: text},
		})
	},
	async newComment(text, id) {
		return request(apiUrl("/comments/create"), {
			method: "POST",
			params: {text: text, parent: id},
		})
	}
}

//shared
const demoSource =
	"https://github.com/MithrilJS/mithril.js/tree/master/examples/threaditjs"
function Header() {
	return [
		m("p.head_links", [
			m("a", {href: demoSource}, "Source"), " | ",
			m("a[href='http://threaditjs.com']", "ThreaditJS Home"),
		]),
		m("h2", [
			m(Link, {href: "/"}, "ThreaditJS: Mithril"),
		]),
	]
}

//home
function Home(attrs, context, threads = []) {
	return [
		m(Header),
		m(".main", m(Async, {
			init: () => api.home().then(response => {
				document.title = "ThreaditJS: Mithril | Home"
				context.update(response.data)
			}),
			pending: () => m("h2", "Loading"),
			error: e => e.status === 404
				? m("h2", "Not found! Don't try refreshing!")
				: m("h2", "Error! Try refreshing."),
			ready: () => [
				m(keyed, threads.map(thread =>
					m(fragment, {key: thread.id}, [
						m("p", [
							m(Link, {href: `/thread/${thread.id}`}, [
								m(trust, T.trimTitle(thread.text))
							]),
						]),
						m("p.comment_count", thread.comment_count, " comment(s)"),
						m("hr"),
					])
				)),
				m(NewThread, {onSave(thread) {
					context.update([...threads, thread])
				}}),
			]
		}))
	]
}

function NewThread({save}, context, value = "") {
	return m("form", {onsubmit: () => {
		api.newThread(value).then(({data: thread}) => {
			onSave(thread)
			context.update("")
		})
		return false
	}}, [
		m("textarea", {value,
			oninput: ev => context.update(ev.target.value)
		}),
		m("input[type=submit][value='Post!']"),
	])
}

//thread
function Thread({id}, context) {
	let ref
	if (context.isInit) {
		T.time("Thread render")
		;(ref = context.ref()).update(() => {
			T.timeEnd("Thread render")
		})
	}

	return m(fragment, {ref}, [
		m(Header),
		m(".main", m(Async, {
			key: id,
			init: () => api.thread(id).then(({root: node}) => {
				document.title = `ThreaditJS: Mithril | ${T.trimTitle(node.text)}`
				return node
			}),
			pending: () => m("h2", "Loading"),
			error: e => e.status === 404
				? m("h2", "Not found! Don't try refreshing!")
				: m("h2", "Error! Try refreshing."),
			ready: node => m(ThreadNode, {node})
		}))
	])
}

function ThreadNode({node}) {
	return m(".comment", [
		m("p", m(trust, node.text)),
		m(".reply", m(Reply, {node})),
		m(".children", node.children.map(child =>
			m(ThreadNode, {node: child})
		))
	])
}

function Reply({node}, context, state = {}) {
	const {replying = false, newComment = ""} = state

	if (replying) {
		return m("form", {onsubmit() {
			api.newComment(newComment, node.id).then(response => {
				context.update({replying: false, newComment: ""})
				node.children.push(response.data)
			})
			return false
		}}, [
			m("textarea", {
				value: newComment,
				oninput(ev) {
					context.update({...state, newComment: ev.target.value})
				},
			}),
			m("input[type=submit][value='Reply!']"),
			m(".preview", m(trust, T.previewComment(newComment))),
		])
	} else {
		return m("a", {onclick() {
			context.update({replying: true, newComment: ""})
			return false
		}}, "Reply!")
	}
}

//router
mount(document.getElementById("app"), () => m(Route, {
	default: "/",
	"/thread/:id": ({id}) => m(Thread, {id}),
	"/": () => m(Home),
}))
