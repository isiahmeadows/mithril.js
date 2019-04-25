import {api, demoSource} from "../threaditjs-common/common.mjs"
import m from "mithril"

// shared
const Header = {
	view: () => [
		m("p.head_links", [
			m("a", {href: demoSource("mithril-v2")}, "Source"), " | ",
			m("a[href='http://threaditjs.com']", "ThreaditJS Home"),
		]),
		m("h2", [
			m("a[href=/]", {oncreate: m.route.link}, "ThreaditJS: Mithril"),
		]),
	]
}

function Layout({attrs}) {
	const controller = new AbortController()
	let state = "loading"

	attrs.load(controller.signal)
		.then((response) => {
			state = "ready"
			attrs.onload(response)
		}, (e) => {
			state = e.status === 404 ? "notFound" : "error"
		})
		.finally(m.redraw)

	function pageView() {
		switch (state) {
			case "loading": return m("h2", "Loading")
			case "notFound": return m("h2", "Not found! Don't try refreshing!")
			case "error": return m("h2", "Error! Try refreshing.")
			default: return attrs.view()
		}
	}

	return {
		onremove: () => controller.abort(),

		view: (vnode) => {
			attrs = vnode.attrs
			return [
				m(Header),
				m(".main", pageView()),
			]
		},
	}
}

// home
var ThreadPreview = {
	view: ({attrs: {thread: {id, text, comment_count}}}) => [
		m("p", m("a", {
			href: `/thread/${id}`,
			oncreate: m.route.link,
			innerHTML: T.trimTitle(text),
		})),
		m("p.comment_count", comment_count, " comment(s)"),
		m("hr"),
	]
}

function Home() {
	let threads = []

	return {
		view: () => m(Layout, {
			load: (signal) => api.home({signal}),
			onload: (response) => {
				document.title = "ThreaditJS: React | Home"
				threads = response.data
			},
			view: () => [
				// eslint-disable-next-line camelcase
				threads.map((thread) =>
					m(ThreadPreview, {key: thread.id, thread})
				),
				m(NewThread, {onsave(thread) {
					threads.push(thread)
				}})
			]
		}),
	}
}

function NewThread() {
	let value

	return {
		view: ({attrs}) => m("form", {onsubmit() {
			api.newThread(value)
				.then(({data: thread}) => {
					value = ""
					if (attrs.onsave) attrs.onsave(thread)
				})
				.finally(m.redraw)
			return false
		}}, [
			m("textarea", {value, oninput: (ev) => value = ev.target.value}),
			m("input[type=submit][value='Post!']"),
		])
	}
}

// thread
function Thread({attrs}) {
	T.time("Thread render")
	let node
	return {
		oncreate: () => T.timeEnd("Thread render"),
		view: ({attrs}) => m(Layout, {
			key: attrs.id,
			load: (signal) => api.thread(attrs.id, {signal}),
			onload: (response) => {
				node = response.root
				const title = T.trimTitle(node.text)
				document.title = `ThreaditJS: React | ${title}`
			},
			view: () => m(ThreadNode, {node}),
		}),
	}
}

const ThreadNode = {
	view: ({attrs: {node}}) => m(".comment", [
		m("p", m.trust(node.text)),
		m(".reply", m(Reply, {node})),
		m(".children", node.children.map((child) =>
			m(ThreadNode, {key: child.id, node: child})
		)),
	]),
}

function Reply() {
	let replying = false, newComment = ""

	return {
		view: ({attrs: {node}}) =>
			replying
				? m("form", {onsubmit() {
					api.newComment(newComment, node.id).then((response) => {
						node.children.push(response.data)
						replying = false; newComment = ""
					})
					return false
				}}, [
					m("textarea", {
						value: newComment,
						oninput: (ev) => newComment = ev.target.value,
					}),
					m("input[type=submit][value='Reply!']"),
					m(".preview", m.trust(T.previewComment(newComment))),
				])
				: m("a", {onclick() {
					replying = true; newComment = ""
					return false
				}}, "Reply!")
	}
}

// router
m.route(document.getElementById("app"), "/", {
	"/": Home,
	"/thread/:id": Thread,
})
