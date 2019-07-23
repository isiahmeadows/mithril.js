import {
	DOM, Router, abortable, distinct, link,
	map, p, pure, render, request, store,
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

const demoSource =
	"https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/" +
	"threaditjs/mithril-redesign-jsx"

// shared
function Header() {
	return <>
		<p class="head_links">
			<a href={demoSource}>Source</a> | {""}
			<a href="http://threaditjs.com">ThreaditJS Home</a>
		</p>
		<h2>
			<a href="/">{link()}ThreaditJS: Mithril</a>
		</h2>
	</>
}

const Layout = pure(({load, children: [loaded]}) => <>
	<Header />
	<div class="main">
		{abortable((signal, o) => {
			o.next(<h2>Loading</h2>)
			return load(signal).then(
				(response) => o.next(loaded(response)),
				(e) => o.next(
					e.status === 404
						? <h2>Not found! Don't try refreshing!</h2>
						: <h2>Error! Try refreshing.</h2>
				)
			)
		})}
	</div>
</>)

// home
// eslint-disable-next-line camelcase
const ThreadPreview = pure(({thread: {id, text, comment_count}}) => <>
	<p>
		<a {...link()} href={`/thread/${id}`} innerHTML={T.trimTitle(text)} />
	</p>
	{/* eslint-disable-next-line camelcase */}
	<p class="comment_count">{comment_count} comment(s)</p>
	<hr />
</>)

function Home() {
	const [threads, dispatch] = store([], (threads, action) => {
		if (action.type === "set") return action.threads
		if (action.type === "append") return [...threads, action.thread]
	})

	return <Layout load={(s) => api.home({signal: s})}>
		{(response) => {
			document.title = "ThreaditJS: Mithril | Home"
			dispatch({type: "set", threads: response.data})
			return <>
				<Keyed list={threads} by="id">
					{(thread) => <ThreadPreview thread={thread} />}
				</Keyed>
				<NewThread onsave={(ev) => {
					dispatch({type: "append", thread: ev.thread})
				}} />
			</>
		}}
	</Layout>
}

function NewThread(attrs, events) {
	let textarea
	return (
		<form onsubmit={async (_, capture) => {
			capture()
			const {data: thread} = await api.newThread(textarea.value)
			textarea.value = ""
			events.emit("save", thread)
		}}>
			<textarea afterCommit={(elem) => textarea = elem} />
			<input type="submit" value="Post!" />
		</form>
	)
}

// thread
function Thread(attrs) {
	return map(distinct(attrs, "id"), ({id}) => {
		T.time("Thread render")
		return <Self replace afterCommit={() => T.timeEnd("Thread render")}>
			<Layout load={(s) => api.thread(id, {signal: s})}>
				{({root}) => {
					const title = T.trimTitle(root.text)
					document.title = `ThreaditJS: Mithril | ${title}`
					return <ThreadNode node={root} />
				}}
			</Layout>
		</Self>
	})
}

const ThreadNode = pure(({node}) => (
	<div class="comment">
		<p innerHTML={node.text} />
		<div class="reply"><Reply node={node} /></div>
		<div class="children">
			<Keyed list={node.children} by="id">
				{(child) => <ThreadNode node={child} />}
			</Keyed>
		</div>
	</div>
))

function Reply(attrs) {
	return (o) => {
		const [preview, setPreview] = store("")
		let node
		attrs({next: (curr) => node = curr.node})
		renderReplyButton()

		function renderReplyForm() {
			let textarea
			o.next(<form onsubmit={async (_, capture) => {
				capture()
				const {data} = await api.newComment(textarea.value, node.id)
				node.children.push(data)
				renderReplyButton()
			}}>
				<textarea
					afterCommit={(elem) => textarea = elem}
					oninput={() => {
						setPreview(T.previewComment(textarea.value))
					}}
				/>
				<input type="submit" value="Reply!" />
				<div class="preview" innerHTML={preview} />
			</form>)
		}

		function renderReplyButton() {
			o.next(
				<a onclick={(_, capture) => {
					capture()
					renderReplyForm()
				}}>
					Reply!
				</a>
			)
		}
	}
}

// router
render("#app", new Router(DOM).match([
	["/", () => <Home />],
	["/thread:id", ({id}) => <Thread id={id} />],
]))
