import {abortable, m, pure, render, Keyed, Fragment} from "mithril"
import {api, demoSource} from "../threaditjs-common/common.mjs"
import {map, store} from "mithril/stream"
import {match, Link} from "mithril/router"

// shared
function Header() {
	return <>
		<p class="head_links">
			<a href={demoSource("mithril-redesign")}>Source</a> | {""}
			<a href="http://threaditjs.com">ThreaditJS Home</a>
		</p>
		<h2>
			<Link><a href="/">ThreaditJS: Mithril</a></Link>
		</h2>
	</>
}

const Layout = pure(({load, children}) => <>
	<Header />
	<div class="main">
		{abortable((signal, o) => {
			o.next(<h2>Loading</h2>)
			return load(signal).then(
				(response) => o.next(children(response)),
				(e) => o.next(e.status === 404
					? <h2>Not found! Don&apos;t try refreshing!</h2>
					: <h2>Error! Try refreshing.</h2>)
			)
		})}
	</div>
</>)

// home
// eslint-disable-next-line camelcase
const ThreadPreview = pure(({thread: {id, text, comment_count}}) => <>
	<p>
		<Link>
			<a href={`/thread/${id}`} innerHTML={T.trimTitle(text)} />
		</Link>
	</p>
	<p class="comment_count">{comment_count} comment(s)</p>
	<hr />
</>)

function Home() {
	const [threads, dispatch] = store([], (threads, action) => {
		if (action.type === "set") return action.threads
		if (action.type === "append") return [...threads, action.thread]
	})

	function onSave(ev) {
		dispatch({type: "append", thread: ev.thread})
	}

	return (
		<Layout load={(signal) => api.home({signal})}>
			{(response) => {
				document.title = "ThreaditJS: Mithril | Home"
				dispatch({type: "set", threads: response.data})
				return <>
					{map(threads, (list) => (
						<Keyed>
							{/* eslint-disable-next-line camelcase */}
							{list.map((thread) => (
								<ThreadPreview
									key={thread.id}
									thread={thread}
								/>
							))}
						</Keyed>
					))}
					<NewThread on={[onSave, "save"]} />
				</>
			}}
		</Layout>
	)
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

	return (
		<form on={[onSubmit, "submit"]}>
			<textarea ref={(elem) => textarea = elem} />
			<input type="submit" value="Post!" />
		</form>
	)
}

// thread
function Thread(attrs) {
	T.time("Thread render")
	return (
		<Fragment ref={() => T.timeEnd("Thread render")}>
			{map(attrs, ({id}) => (
				<Layout key={id} load={(signal) => api.thread(id, {signal})}>
					{({root: node}) => {
						const title = T.trimTitle(node.text)
						document.title = `ThreaditJS: Mithril | ${title}`
						return <ThreadNode node={node}/>
					}}
				</Layout>
			))}
		</Fragment>
	)
}

const ThreadNode = pure(({node}) => (
	<div class="comment">
		<p innerHTML={node.text} />
		<div class="reply"><Reply node={node} /></div>
		<div class="children">
			<Keyed>
				{node.children.map((child) => (
					<ThreadNode key={child.id} node={child} />
				))}
			</Keyed>
		</div>
	</div>
))

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

	return map(replying, (replying) => {
		if (replying) {
			return (
				<form on={[receiver, "submit"]}>
					<textarea
						ref={(elem) => textarea = elem}
						on={[receiver, "input"]}
					/>
					<input type="submit" value="Reply!" />
					<div
						class="preview"
						innerHTML={map(comment, T.previewComment)}
					/>
				</form>
			)
		} else {
			return (
				<a on={[receiver, "click"]}>Reply!</a>
			)
		}
	})
}

// router
render("#app", match({
	default: "/",
	"/": () => <Home />,
	"/thread/:id": ({id}) => <Thread, id={id} />,
}))
