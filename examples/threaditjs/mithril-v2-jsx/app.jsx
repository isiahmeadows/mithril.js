import m from "mithril"

// API calls
T.time("Setup")

const api = {
	async home(opts) {
		T.timeEnd("Setup")
		return m.request("/threads", opts)
	},
	async thread(id, opts) {
		T.timeEnd("Setup")
		return T.transformResponse(
			await m.request("/threads/:id", {params: {id}, ...opts})
		)
	},
	async newThread(text, opts) {
		return m.request("/threads/create", {
			method: "POST",
			params: {text},
			...opts,
		})
	},
	async newComment(text, id, opts) {
		return m.request("/threads/create", {
			method: "POST",
			params: {text, parent},
			...opts,
		})
	},
}

// shared
const demoSource =
	"https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/" +
	"threaditjs/mithril-v2-jsx"

const Header = {
	view: () => <>
		<p class="head_links">
			<a href={demoSource("mithril-v2")}>Source</a> | {""}
			<a href="http://threaditjs.com">ThreaditJS Home</a>
		</p>
		<h2>
			<m.route.Link href="/">ThreaditJS: Mithril</m.route.Link>
		</h2>
	</>,
}

function Layout({attrs}) {
	const controller = new AbortController()
	let state = "loading"
	let value

	attrs.load(controller.signal)
		.then((response) => {
			state = "ready"
			value = attrs.onLoad(response)
		}, (e) => {
			state = e.status === 404 ? "notFound" : "error"
		})
		.finally(m.redraw)

	function pageView() {
		switch (state) {
			case "loading": return <h2>Loading</h2>
			case "notFound": return <h2>Not found! Don't try refreshing!</h2>
			case "error": return <h2>Error! Try refreshing.</h2>
			default: return attrs.view(value)
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
		{/* eslint-disable-next-line camelcase */}
		<p class="comment_count">{comment_count} comment(s)</p>
		<hr />
	</>,
}

const Home = {
	view: () => (
		<Layout
			load={(signal) => api.home({signal})}
			onLoad={(response) => {
				document.title = "ThreaditJS: React | Home"
				return response.data
			}}
			view={(threads) => <>
				// eslint-disable-next-line camelcase
				{threads.map((thread) =>
					<ThreadPreview key={thread.id} thread={thread} />
				)}
				<NewThread onSave={(thread) => {
					threads.push(thread)
				}} />
			</>}
		/>
	),
}

function NewThread() {
	let value

	return {
		view: ({attrs}) => (
			<form onsubmit={() => {
				api.newThread(value)
					.then(({data: thread}) => {
						value = ""
						if (attrs.onSave) attrs.onSave(thread)
					})
					.finally(m.redraw)
				return false
			}}>
				<textarea value={value} oninput={(ev) => value = ev.target.value} />
				<input type="submit" value="Post!" />
			</form>
		),
	}
}

// thread
const Thread = {
	oninit: () => T.time("Thread render"),
	oncreate: () => T.timeEnd("Thread render"),
	view: ({attrs}) => (
		<Layout
			key={attrs.id}
			load={(signal) => api.thread(attrs.id, {signal})}
			onLoad={(response) => {
				const title = T.trimTitle(response.root.text)
				document.title = `ThreaditJS: React | ${title}`
				return response.root
			}}
			view={(node) => <ThreadNode node={node} />}
		/>
	),
}

const ThreadNode = {
	view: ({attrs: {node}}) => (
		<div class="comment">
			<p>{m.trust(node.text)}</p>,
			<div class="reply"><Reply node={node} /></div>
			<div class="children">{node.children.map(
				(child) => <ThreadNode key={child.id} node={child} />
			)}</div>
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
						<input type="submit" value="Reply!" />
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
