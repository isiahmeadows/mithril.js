import * as Cell from "mithril/cell"
import * as Router from "mithril/route"
import {abortable, m, pure, render} from "mithril"
import {api, demoSource} from "../threaditjs-common/common.mjs"

// shared
function Header() {
	return [
		m("p.head_links", [
			m("a", {href: demoSource("mithril-redesign")}, "Source"), " | ",
			m("a[href='http://threaditjs.com']", "ThreaditJS Home"),
		]),
		m("h2", [
			m(Router.Link, m("a[href=/]", "ThreaditJS: Mithril")),
		]),
	]
}

// home
function Home() {
	return [
		m(Header),
		m("div.main", abortable((signal, render) => {
			const update = (threads) => render([
				// eslint-disable-next-line camelcase
				m("#keyed", threads.map(({id, text, comment_count}) =>
					m("#fragment", {key: id}, [
						m("p", [
							m(Router.Link, m("a", {
								href: `/thread/${id}`,
								innerHTML: T.trimTitle(text),
							})),
						]),
						m("p.comment_count", comment_count, " comment(s)"),
						m("hr"),
					])
				)),
				m(NewThread, {onsave(thread) {
					update([...threads, thread])
				}}),
			])
			render(m("h2", "Loading"))
			api.home({signal}).then((response) => {
				document.title = "ThreaditJS: Mithril | Home"
				update(response.data)
			}, (e) => {
				render(e.status === 404
					? m("h2", "Not found! Don't try refreshing!")
					: m("h2", "Error! Try refreshing."))
			})
		}))
	]
}

function NewThread(attrs) {
	let textarea, onsave
	attrs((current) => onsave = current.onsave)
	return m("form", {onsubmit() {
		api.newThread(textarea.value).then(({data: thread}) => {
			if (onsave) onsave(thread)
			textarea.value = ""
		})
		return false
	}}, [
		m("textarea", {ref: (elem) => textarea = elem}),
		m("input[type=submit][value='Post!']"),
	])
}

// thread
function Thread(attrs) {
	T.time("Thread render")
	return m("#fragment", {ref: () => T.timeEnd("Thread render")}, [
		m(Header),
		m("div.main", Cell.map(
			Cell.distinct(attrs, ({id}) => id),
			({id}) => m("#fragment", {key: id}, abortable((signal, render) => {
				render(m("h2", "Loading"))
				api.thread(id, {signal}).then(({root: node}) => {
					document.title =
							`ThreaditJS: Mithril | ${T.trimTitle(node.text)}`
					render(m(ThreadNode, {node}))
				}, (e) => {
					render(e.status === 404
						? m("h2", "Not found! Don't try refreshing!")
						: m("h2", "Error! Try refreshing."))
				})
			}))
		)),
	])
}

const ThreadNode = pure(({node}) => m("div.comment", [
	m("p", m("#html", node.text)),
	m("div.reply", m(Reply, {node})),
	m("div.children", m("#keyed", node.children.map((child) =>
		m(ThreadNode, {key: child.id, node: child})
	)))
]))

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
				m("div.preview", m("#html", T.previewComment(newComment))),
			])
		)

		const updateClosed = () => render(
			m("a", {onclick() { updateReplying(""); return false }}, "Reply!")
		)

		updateClosed()
	})
}

// router
render(document.getElementById("app"), Router.match({
	default: "/",
	"/": () => m(Home),
	"/thread/:id": ({id}) => m(Thread, {id}),
}))
