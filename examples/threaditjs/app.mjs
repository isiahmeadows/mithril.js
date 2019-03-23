// Mithril redesign (this): 144 lines.
// React: 206 lines.
// React + experimental Hooks: 174 lines.
// Totals exclude this header comment.
// Mithril redesign is ~30% smaller than React, ~17% smaller than React + hooks.
import * as Cell from "mithril/cell"
import {Fragment, Keyed, Trust, m, render as mount, ref} from "mithril"
import {api, demoSource} from "../threaditjs-common/common.mjs"
import Async from "mithril/async"
import Router from "mithril/route"

//shared
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
function Home() {
	return [
		m(Header),
		m(".main", m(Async, {
			init: () => api.home().then((response) => {
				document.title = "ThreaditJS: Mithril | Home"
				return response.data
			}),
			loading: () => m("h2", "Loading"),
			error: (e) => e.status === 404
				? m("h2", "Not found! Don't try refreshing!")
				: m("h2", "Error! Try refreshing."),
			ready: (threads) => (render) => {
				const update = (threads) => render([
					// eslint-disable-next-line camelcase
					m(Keyed, threads.map(({id, text, comment_count}) =>
						m(Fragment, {key: id}, [
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
				update(threads)
			}
		}))
	]
}

function NewThread(attrs) {
	attrs = Cell.ref(attrs)
	const textarea = ref()
	return m("form", {onsubmit() {
		api.newThread(textarea.current.value).then(({data: thread}) => {
			if (attrs.current.onsave) attrs.current.onsave(thread)
			textarea.value = ""
		})
		return false
	}}, [
		m("textarea", {ref: textarea}),
		m("input[type=submit][value='Post!']"),
	])
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
