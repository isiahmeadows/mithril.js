import {api, demoSource} from "../threaditjs-common/common.mjs"
import m from "mithril"
const Fragment = "["

// shared
const Header = {
	view: () => <>
		<p class="head_links">
			<a href={demoSource("mithril-v2")}>Source</a> | {""}
			<a href="http://threaditjs.com">ThreaditJS Home</a>
		</p>
		<h2>
			<a href="/" oncreate={m.route.link}>ThreaditJS: Mithril</a>
		</h2>
	</>,
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
			case "loading": return <h2>Loading</h2>
			case "notFound": return <h2>Not found! Don't try refreshing!</h2>
			case "error": return <h2>Error! Try refreshing.</h2>
			default: return attrs.view()
		}
	}

	return {
		onremove: () => controller.abort(),

		view: (vnode) => {
			attrs = vnode.attrs
			return <>
				<Header />
				<div class="main">{pageView()}</div>
			</>
		},
	}
}

// home
const ThreadPreview = {
	// eslint-disable-next-line camelcase
	view: ({attrs: {thread: {id, text, comment_count}}}) => <>
		<p>
			<Link>
				<a href={`/thread/${id}`} innerHTML={T.trimTitle(text)} />
			</Link>
		</p>
		<p class="comment_count">{comment_count} comment(s)</p>
		<hr />
	</>,
}

function Home() {
	let threads = []

	return {
		view: () => (
			<Layout
				load={(signal) => api.home({signal})}
				onload={(response) => {
					document.title = "ThreaditJS: React | Home"
					threads = response.data
				}}
				view={() => <>
					// eslint-disable-next-line camelcase
					{threads.map((thread) =>
						<ThreadPreview key={thread.id} thread={thread} />
					)}
					<NewThread onsave={(thread) => {
						threads.push(thread)
					}} />
				</>}
			/>
		),
	}
}

function NewThread() {
	let value

	return {
		view: ({attrs}) => (
			<form onsubmit={() => {
				api.newThread(value)
					.then(({data: thread}) => {
						value = ""
						if (attrs.onsave) attrs.onsave(thread)
					})
					.finally(m.redraw)
				return false
			}}>
				<textarea value={value} oninput={(ev) => value = ev.target.value} />
				<input type=submit  value="Post!" />
			</form>
		),
	}
}

// thread
function Thread({attrs}) {
	T.time("Thread render")
	let node
	return {
		oncreate: () => T.timeEnd("Thread render"),
		view: ({attrs}) => (
			<Layout
				key={attrs.id}
				load={(signal) => api.thread(attrs.id, {signal})}
				onload={(response) => {
					node = response.root
					const title = T.trimTitle(node.text)
					document.title = `ThreaditJS: React | ${title}`
				}}
				view={() => <ThreadNode node={node} />}
			/>
		),
	}
}

const ThreadNode = {
	view: ({attrs: {node}}) => (
		<div class="comment">
			<p>{m.trust(node.text)}</p>,
			<div class="reply"><Reply node={node} /></div>
			<div class="children">{node.children.map((child) =>
				<ThreadNode key={child.id node={child} />
			}</div>
		</div>
	),
}

function Reply() {
	let replying = false, newComment = ""

	return {
		view: ({attrs: {node}}) => {
			if (replying) {
				return (
					<form onsubmit={() => {
						api.newComment(newComment, node.id).then((response) => {
							node.children.push(response.data)
							replying = false; newComment = ""
						})
						return false
					}}>
						<textarea
							value={newComment}
							oninput={(ev) => newComment = ev.target.value}
						/>
						<input type=submit value="Reply!" />
						<div class="preview">
							{m.trust(T.previewComment(newComment))}
						</div>
					</form>
				)
			} else {
				return (
					<a onclick={() => {
						replying = true; newComment = ""
						return false
					}}>
						Reply!
					</a>
				)
			}
		},
	}
}

// router
m.route(document.getElementById("app"), "/", {
	"/": Home,
	"/thread/:id": Thread,
})
