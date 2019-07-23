import {
	DOM, Router, abortable, distinct,
	keyed, link, m, map, p, pure, render,
	replace, request, store,
} from "mithril"

// API calls
T.time("Setup")

const api = {
	async home(opts) {
		T.timeEnd("Setup")
		return request("/threads", opts)
	},
	async thread(id, opts) {
		T.timeEnd("Setup")
		return T.transformResponse(
			await request(p("/threads/:id", {id}), opts)
		)
	},
	async newThread(text, opts) {
		return request(p("/threads/create", {text}), {method: "POST", ...opts})
	},
	async newComment(text, id, opts) {
		return request(
			p("/threads/create", {text, parent}),
			{method: "POST", ...opts}
		)
	},
}

// shared
const demoSource =
	"https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/" +
	"threaditjs/mithril-redesign-vanilla"

function Header() {
	return [
		m("p.head_links", [
			m("a", {href: demoSource}, "Source"), " | ",
			m("a[href='http://threaditjs.com']", "ThreaditJS Home"),
		]),
		m("h2 > a[href=/]", link(), "ThreaditJS: Mithril"),
	]
}

const Layout = pure(({load, children: [loaded]}) => [
	m(Header),
	m("div.main", abortable((signal, o) => {
		o.next(m("h2", "Loading"))
		return load(signal).then(
			(response) => o.next(loaded(response)),
			(e) => o.next(
				e.status === 404
					? m("h2", "Not found! Don't try refreshing!")
					: m("h2", "Error! Try refreshing.")
			)
		)
	}))
])

// home
// eslint-disable-next-line camelcase
const ThreadPreview = pure(({thread: {id, text, comment_count}}) => [
	m("p > a", link(), {href: `/thread/${id}`, innerHTML: T.trimTitle(text)}),
	m("p.comment_count", comment_count, " comment(s)"),
	m("hr"),
])

function Home() {
	const [threads, dispatch] = store([], (threads, action) => {
		if (action.type === "set") return action.threads
		if (action.type === "append") return [...threads, action.thread]
	})

	return m(Layout, {load: (s) => api.home({signal: s})}, (response) => {
		document.title = "ThreaditJS: Mithril | Home"
		dispatch({type: "set", threads: response.data})
		return [
			keyed(threads, "id", (thread) => m(ThreadPreview, {thread})),
			m(NewThread, {onsave(ev) {
				dispatch({type: "append", thread: ev.thread})
			}}),
		]
	})
}

function NewThread(attrs, events) {
	let textarea
	return m("form", [
		m("textarea", {afterCommit(elem) { textarea = elem }}),
		m("input[type=submit][value='Post!']"),
		{async onsubmit(_, capture) {
			capture()
			const {data: thread} = await api.newThread(textarea.value)
			textarea.value = ""
			events.emit("save", thread)
		}},
	])
}

// thread
function Thread(attrs) {
	return map(distinct(attrs, "id"), ({id}) => {
		T.time("Thread render")
		return replace([
			{afterCommit() { T.timeEnd("Thread render") }},
			m(Layout, {load: (s) => api.thread(id, {signal: s})}, ({root}) => {
				const title = T.trimTitle(root.text)
				document.title = `ThreaditJS: Mithril | ${title}`
				return m(ThreadNode, {node: root})
			})
		])
	})
}

const ThreadNode = pure(({node}) => m("div.comment", [
	m("p", {innerHTML: node.text}),
	m("div.reply", m(Reply, {node})),
	m("div.children", keyed(node.children, "id",
		(child) => m(ThreadNode, {node: child})
	)),
]))

function Reply(attrs) {
	return (o) => {
		const [preview, setPreview] = store("")
		let node
		attrs({next: (curr) => node = curr.node})
		renderReplyButton()

		function renderReplyForm() {
			o.next(m("form", [
				m("textarea", {oninput(ev) {
					setPreview(T.previewComment(ev.currentTarget.value))
				}}),
				m("input[type=submit][value='Reply!']"),
				m("div.preview", {innerHTML: preview}),
				{async onsubmit(ev, capture) {
					capture()
					const value = ev.currentTarget.elements[0].value
					const {data} = await api.newComment(value, node.id)
					node.children.push(data)
					renderReplyButton()
				}}
			]))
		}

		function renderReplyButton() {
			o.next(m("a", "Reply!", {onclick() {
				renderReplyForm()
				return false
			}}))
		}
	}
}

// router
render("#app", new Router(DOM).match([
	["/", () => m(Home)],
	["/thread:id", ({id}) => m(Thread, {id})],
]))
