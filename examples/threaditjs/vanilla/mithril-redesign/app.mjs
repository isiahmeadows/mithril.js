import {Link, match} from "mithril/router"
import {abortable, m, pure, render} from "mithril"
import {api, demoSource} from "../threaditjs-common/common.mjs"
import {distinct, map, store} from "mithril/stream"
import Control from "mithril/control"

// shared
function Header() {
	return [
		m("p.head_links", [
			m("a", {href: demoSource("mithril-redesign")}, "Source"), " | ",
			m("a[href='http://threaditjs.com']", "ThreaditJS Home"),
		]),
		m("h2", [
			m(Link, m("a[href=/]", "ThreaditJS: Mithril")),
		]),
	]
}

const Layout = pure(({load, children: [loaded]}) => [
	m(Header),
	m("div.main", abortable((signal, o) => {
		o.next(m("h2", "Loading"))
		return load(signal).then(
			(response) => o.next(loaded(response)),
			(e) => o.next(e.status === 404
				? m("h2", "Not found! Don't try refreshing!")
				: m("h2", "Error! Try refreshing."))
		)
	}))
])

// home
// eslint-disable-next-line camelcase
const ThreadPreview = pure(({thread: {id, text, comment_count}}) => [
	m("p", [
		m(Link, m("a", {href: `/thread/${id}`, innerHTML: T.trimTitle(text)})),
	]),
	m("p.comment_count", comment_count, " comment(s)"),
	m("hr"),
])

function Home() {
	const [threads, dispatch] = store([], (threads, action) => {
		if (action.type === "set") return action.threads
		if (action.type === "append") return [...threads, action.thread]
	})

	function onSave(ev) {
		dispatch({type: "append", thread: ev.thread})
	}

	return m(Layout, {load: (signal) => api.home({signal})}, (response) => {
		document.title = "ThreaditJS: Mithril | Home"
		dispatch({type: "set", threads: response.data})
		return [
			map(threads, (list) => m("#keyed", {of: list, by: "id"}, (thread) =>
				m(ThreadPreview, {thread})
			)),
			m(NewThread, {on: [onSave, "save"]}),
		]
	})
}

function NewThread(attrs, emit) {
	let textarea
	async function onSubmit(_, capture) {
		capture()
		const {data: thread} = api.newThread(textarea.value)
		emit({type: "save", thread}, capture)
		textarea.value = ""
	}

	return m("form", {on: [onSubmit, "submit"]}, [
		m("textarea", {ref: (elem) => textarea = elem}),
		m("input[type=submit][value='Post!']"),
	])
}

// thread
function Thread(attrs) {
	T.time("Thread render")
	return m("#fragment", {ref: () => T.timeEnd("Thread render")}, () =>
		map(distinct(attrs, "id"), ({id}) =>
			m(Control, {key: id}, m(Layout, {
				load: (signal) => api.thread(id, {signal}),
			}, (response) => {
				const title = T.trimTitle(response.root.text)
				document.title = `ThreaditJS: Mithril | ${title}`
				return m(ThreadNode, {node: response.root})
			}))
		),
	)
}

const ThreadNode = pure(({node}) => m("div.comment", [
	m("p", {innerHTML: node.text}),
	m("div.reply", m(Reply, {node})),
	m("div.children", m("#keyed", {of: node.children, by: "id"}, (child) =>
		m(ThreadNode, {node: child})
	))
]))

function Reply(attrs) {
	const [comment, setPreview] = store("")
	const [replying, setReplying] = store(false)
	let textarea, node
	attrs({next: (curr) => node = curr.node})

	async function receiver(ev, capture) {
		if (ev.type === "click") {
			capture()
			setReplying(true)
		} else if (ev.type === "submit") {
			capture()
			const response = await api.newComment(textarea.value, node.id)
			node.children.push(response.data)
			setReplying(false)
		} else {
			setPreview(T.previewComment(textarea.value))
		}
	}

	return map(replying, (replying) =>
		replying
			? m("form", {on: [receiver, "submit"]}, [
				m("textarea", {
					ref: (elem) => textarea = elem,
					on: [receiver, "input"]
				}),
				m("input[type=submit][value='Reply!']"),
				m("div.preview", {innerHTML: distinct(comment)}),
			])
			: m("a", {on: [receiver, "click"]}, "Reply!")
	)
}

// router
render("#app", match({
	default: "/",
	"/": () => m(Home),
	"/thread/:id": ({id}) => m(Thread, {id}),
}))
