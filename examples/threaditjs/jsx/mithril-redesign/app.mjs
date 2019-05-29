/* eslint-disable-next-line no-unused-vars */
import {Fragment, Keyed, abortable, m, pure, render} from "mithril"
import {Link, match} from "mithril/router"
import {api, demoSource} from "../threaditjs-common/common.mjs"
import {distinct, map, store} from "mithril/stream"
import Control from "mithril/control"

// shared
function Header() {
	return <>
		<p className="head_links">
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
	<div className="main">
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
	<p className="comment_count">{comment_count} comment(s)</p>
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
						<Keyed of={list} by="id">
							{(thread) => <ThreadPreview thread={thread} />}
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
	async function onSubmit(_, capture) {
		capture()
		const {data: thread} = await api.newThread(textarea.value)
		emit({type: "save", thread})
		textarea.value = ""
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
			{map(distinct(attrs, "id"), ({id}) => (
				<Control key={id}>
					<Layout load={(signal) => api.thread(id, {signal})}>
						{({root: node}) => {
							const title = T.trimTitle(node.text)
							document.title = `ThreaditJS: Mithril | ${title}`
							return <ThreadNode node={node}/>
						}}
					</Layout>
				</Control>
			))}
		</Fragment>
	)
}

const ThreadNode = pure(({node}) => (
	<div className="comment">
		<p innerHTML={node.text} />
		<div className="reply"><Reply node={node} /></div>
		<div className="children">
			<Keyed of={node.children} by="id">
				{(child) => <ThreadNode node={child} />}
			</Keyed>
		</div>
	</div>
))

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

	return map(replying, (replying) => {
		if (replying) {
			return (
				<form on={[receiver, "submit"]}>
					<textarea
						ref={(elem) => textarea = elem}
						on={[receiver, "input"]}
					/>
					<input type="submit" value="Reply!" />
					<div className="preview" innerHTML={distinct(comment)} />
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
	"/thread/:id": ({id}) => <Thread id={id} />,
}))
