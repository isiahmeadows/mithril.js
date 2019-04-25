import {abortable, m, pure, render} from "mithril"
import {api, demoSource} from "../threaditjs-common/common.mjs"
import {map, distinct, store} from "mithril/stream"
import {match, Link} from "mithril/router"

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
			m("#keyed", map(threads, (list) => list.map((thread) =>
				m(ThreadPreview, {key: thread.id, thread})
			))),
			m(NewThread, {on: [onSave, "save"]}),
		]
	})
}

function NewThread(attrs, emit) {
	let textarea
	function onSubmit() {
		api.newThread(textarea.value).then(({data: thread}) => {
			emit({type: "save", thread})
			textarea.value = ""
		})
		return false
	}

	return m("form", {on: [onSubmit, "submit"]}, [
		m("textarea", {ref: (elem) => textarea = elem}),
		m("input[type=submit][value='Post!']"),
	])
}

// thread
function Thread(attrs) {
	T.time("Thread render")
	return m("#fragment", {ref: () => T.timeEnd("Thread render")}, [
		map(distinct(attrs, (a, b) => a.id === b.id), ({id}) => m(Layout, {
			key: id,
			load: (signal) => api.thread(id, {signal}),
		}, (response) => {
			const title = T.trimTitle(response.root.text)
			document.title = `ThreaditJS: Mithril | ${title}`
			return m(ThreadNode, {node: response.root})
		})),
	])
}

const ThreadNode = pure(({node}) => m("div.comment", [
	m("p", {innerHTML: node.text}),
	m("div.reply", m(Reply, {node})),
	m("div.children", m("#keyed", node.children.map((child) =>
		m(ThreadNode, {key: child.id, node: child})
	)))
]))

function Reply(attrs) {
	const [comment, setPreview] = store("")
	const [replying, setReplying] = store(false)
	let textarea, node
	attrs({next: (curr) => node = curr.node})

	function receiver(ev) {
		if (ev.type === "click") {
			setReplying(true)
			return false
		} else if (ev.type === "submit") {
			api.newComment(textarea.value, node.id).then((response) => {
				node.children.push(response.data)
				setReplying(false)
			})
			return false
		} else {
			setPreview(textarea.value)
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
				m("div.preview", {innerHTML: map(comment, T.previewComment)}),
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
