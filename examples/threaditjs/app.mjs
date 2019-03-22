// Mithril v3 (this): 179 lines.
// React: 242 lines.
// React + experimental Hooks: 210 lines.
// Totals exclude this header comment.
// Mithril v3 is ~26% smaller than React, ~15% smaller than React + hooks.
import * as Cell from "mithril/cell"
import {Fragment, Keyed, Trust, component, m, render as mount} from "mithril"
import Async from "mithril/async"
import Router from "mithril/route"
import request from "mithril/request"

T.time("Setup")

//API calls
const apiUrl = (ref) => T.apiUrl + ref
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
			m(Router.Link, m("a[href=/]", "ThreaditJS: Mithril")),
		]),
	]
}

//home
const Home = component((_, context) => {
	let threads = []
	return () => [
		m(Header),
		m(".main", m(Async, {
			init: () => context.wrap(() => api.home().then((response) => {
				document.title = "ThreaditJS: Mithril | Home"
				threads = response.data
			})),
			loading: () => m("h2", "Loading"),
			error: (e) => e.status === 404
				? m("h2", "Not found! Don't try refreshing!")
				: m("h2", "Error! Try refreshing."),
			ready: () => [
				m(Keyed, threads.map((thread) =>
					m(Fragment, {key: thread.id}, [
						m("p", [
							m(Router.Link, m("a", {
								href: `/thread/${thread.id}`,
								innerHTML: T.trimTitle(thread.text),
							})),
						]),
						m("p.comment_count", [
							thread.comment_count, " comment(s)"
						]),
						m("hr"),
					])
				)),
				m(NewThread, {onsave(thread) {
					threads.push(thread)
				}}),
			]
		}))
	]
})

function NewThread(attrs) {
	return Cell.map(attrs, ({onsave}) =>
		m("form", {onsubmit(ev) {
			const textarea = ev.target.elements[0]
			api.newThread(textarea.value).then(({data: thread}) => {
				if (onsave) onsave(thread)
				textarea.value = ""
			})
			return false
		}}, [
			m("textarea[value='']"),
			m("input[type=submit][value='Post!']"),
		])
	)
}

//thread
function Thread(attrs) {
	return (render) => {
		T.time("Thread render")
		render([
			m(Header),
			m(".main", Cell.map(
				Cell.distinct(attrs, ({id}) => id),
				({id}) => m(Async, {
					key: id,
					init: () => api.thread(id).then(({root: node}) => {
						document.title =
							`ThreaditJS: Mithril | ${T.trimTitle(node.text)}`
						return node
					}),
					loading: () => m("h2", "Loading"),
					error: (e) => e.status === 404
						? m("h2", "Not found! Don't try refreshing!")
						: m("h2", "Error! Try refreshing."),
					ready: (node) => m(ThreadNode, {node})
				})
			)),
		]).then(() => {
			T.timeEnd("Thread render")
		})
	}
}

function ThreadNode(attrs) {
	return Cell.map(attrs, ({node}) => m(".comment", [
		m("p", m(Trust, node.text)),
		m(".reply", m(Reply, {node})),
		m(".children", node.children.map((child) =>
			m(ThreadNode, {node: child})
		))
	]))
}

function Reply(attrs) {
	return (render) => attrs(({node}) => {
		const updateReplying = (newComment) => render(
			m("form", {onsubmit() {
				api.newComment(newComment, node.id).then((response) => {
					node.children.push(response.data)
					updateClosed()
				})
				return false
			}}, [
				m("textarea", {
					value: newComment,
					oninput(ev) { updateReplying(ev.target.value) },
				}),
				m("input[type=submit][value='Reply!']"),
				m(".preview", m(Trust, T.previewComment(newComment))),
			])
		)

		const updateClosed = () => render(
			m("a", {onclick() { updateReplying(""); return false }}, "Reply!")
		)

		updateClosed()
	})
}

//router
mount(document.getElementById("app"), Router.match({
	default: "/",
	"/thread/:id": ({id}) => m(Thread, {id}),
	"/": () => m(Home),
}))
