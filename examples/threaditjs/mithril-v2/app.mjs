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

// home
function Home() {
	let state = "loading", threads = []
	const controller = new AbortController()

	api.home({signal: this.controller.signal})
		.then((response) => {
			state = "ready"; threads = response.data
			document.title = "ThreaditJS: React | Home"
		}, (e) => {
			state = e.status === 404 ? "notFound" : "error"
		})
		.finally(m.redraw)

	return {
		view: () => [
			m(Header),
			m(".main", (() => {
				switch (state) {
					case "loading":
						return m("h2", "Loading")

					case "notFound":
						return m("h2", "Not found! Don't try refreshing!")

					case "error":
						return m("h2", "Error! Try refreshing.")

					default:
						return [
							// eslint-disable-next-line camelcase
							threads.map(({id, text, comment_count}) =>
								m.fragment({key: id}, [
									m("p", m("a", {
										href: `/thread/${id}`,
										oncreate: m.route.link,
										innerHTML: T.trimTitle(text),
									})),
									m("p.comment_count", comment_count, " comment(s)"),
									m("hr"),
								])
							),
							m(NewThread, {onsave(thread) {
								threads.push(thread)
							}})
						]
				}
			})())
		],

		onremove: () => controller.abort(),
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
	let state = "loading", node, controller
	function update(id) {
		controller = new AbortController()
		state = "loading"; node = undefined
		api.thread(id).then((response) => {
			state = "ready"; node = response.root
			document.title = `ThreaditJS: React | ${T.trimTitle(node.text)}`
		}, (e) => {
			state = e.status === 404 ? "notFound" : "error"
		})
	}
	update(attrs.id)
	return {
		oncreate: () => T.timeEnd("Thread render"),
		onbeforeupdate: ({attrs}, {attrs: prev}) => {
			if (attrs.id !== prev.id) update(attrs.id)
		},
		onremove: () => {
			if (controller != null) controller.abort()
		},
		view: ({attrs}) => [
			m(Header),
			m(".main", m.fragment({key: attrs.id}, (() => {
				switch (state) {
					case "loading":
						return m("h2", "Loading")

					case "notFound":
						return m("h2", "Not found! Don't try refreshing!")

					case "error":
						return m("h2", "Error! Try refreshing.")

					default:
						return m(ThreadNode, {node})
				}
			})()))
		],
	}
}

const ThreadNode = {
	view: ({node}) => m(".comment", [
		m("p", m("#html", node.text)),
		m(".reply", m(Reply, {node})),
		m(".children", m("#keyed", node.children.map((child) =>
			m(ThreadNode, {key: child.id, node: child})
		)))
	]),
}

function Reply() {
	let replying = false, newComment = ""

	return {
		view: ({attrs: {node}}) => replying
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
