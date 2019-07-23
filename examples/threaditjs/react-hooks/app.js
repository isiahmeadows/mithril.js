import {BrowserRouter, Link, Route} from "react-router"
import React, {useEffect, useLayoutEffect, useRef, useState} from "react"
import ReactDOM from "react-dom"

// API calls
T.time("Setup")

const requestJson = (opts, method = "GET") => async (strs, ...args) => {
	const url = T.apiUrl +
		args.map(encodeURIComponent).map((x, i) => strs[i] + x).join("") +
		strs[strs.length - 1]
	const response = await fetch(url, {...opts, method})
	if (response.ok) return response.json()
	const err = new Error(`${response.status} ${response.statusText}`)
	err.code = response.status
	throw err
}

const api = {
	async home(opts) {
		T.timeEnd("Setup")
		return requestJson(opts)`/threads`
	},
	async thread(id, opts) {
		T.timeEnd("Setup")
		return T.transformResponse(await requestJson(opts)`/threads/${id}`)
	},
	async newThread(text, opts) {
		return requestJson(opts, "POST")`/threads/create?text=${text}`
	},
	async newComment(text, id, opts) {
		return requestJson(opts, "POST")`/comments/create?text=${text}&parent=${id}`
	},
}

// shared
const demoSource =
	"https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/" +
	"threaditjs/react-hooks"

function Header() {
	return <>
		<p className="head_links">
			<a href={demoSource}>Source</a> | {""}
			<a href="http://threaditjs.com">ThreaditJS Home</a>
		</p>
		<h2>
			<Link to="/">ThreaditJS: React</Link>
		</h2>
	</>
}

function Layout({load, onLoad, children}) {
	const [view, setView] = useState(<h2>Loading</h2>)

	useEffect(() => {
		const controller = new AbortController()
		new Promise((resolve) => resolve(load(controller.signal)))
			.then((response) => {
				setView(children)
				onLoad(response)
			}, (e) => {
				setView(e.status === 404
					? <h2>Not found! Don&apos;t try refreshing!</h2>
					: <h2>Error! Try refreshing.</h2>)
			})
		return () => controller.abort()
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	return <>
		<Header />
		<div className="main">{view}</div>
	</>
}

// home
function ThreadPreview({thread}) {
	return <>
		<p>
			<Link
				to={`/thread/${thread.id}`}
				dangerouslySetInnerHTML={{__html: T.trimTitle(thread.text)}}
			/>
		</p>
		<p className="comment_count">{thread.comment_count} comment(s)</p>
		<hr />
	</>
}

function Home() {
	const [threads, setThreads] = useState([])

	return (
		<Layout load={(signal) => api.home({signal})} onLoad={(response) => {
			document.title = "ThreaditJS: React | Home"
			setThreads(response.data)
		}}>
			{threads.map((thread) => (
				<ThreadPreview key={thread.id} thread={thread} />
			))}
			<NewThread onSave={(thread) => setThreads([...threads, thread])} />
		</Layout>
	)
}

function NewThread({onSave}) {
	const [value, setValue] = useState("")

	return (
		<form onSubmit={(ev) => {
			ev.preventDefault()
			ev.stopPropagation()
			api.newThread(value).then(({data: thread}) => {
				if (onSave) onSave(thread)
				setValue("")
			})
		}}>
			<textarea
				value={value}
				onInput={(ev) => setValue(ev.target.value)}
			/>
			<input type="submit" value="Post!" />
		</form>
	)
}

// thread
function Thread({id}) {
	const isInit = useRef(0)

	if (isInit.current === 0) {
		isInit.current = 1
		T.time("Thread render")
	}

	useLayoutEffect(() => {
		if (isInit.current === 1) {
			isInit.current = 2
			T.timeEnd("Thread render")
		}
	}, [])

	const [node, setNode] = useState()

	return (
		<Layout
			key={id}
			load={(signal) => api.thread(id, {signal})}
			onLoad={({root: node}) => {
				document.title = `ThreaditJS: React | ${T.trimTitle(node.text)}`
				setNode(node)
			}}
		>
			<ThreadNode node={node} />
		</Layout>
	)
}

function ThreadNode({node}) {
	return (
		<div className="comment">
			<p dangerouslySetInnerHTML={{__html: node.text}} />
			<div className="reply"><Reply node={node} /></div>
			<div className="children">
				{node.children.map((child) => (
					<ThreadNode key={child.id} node={child} />
				))}
			</div>
		</div>
	)
}

function Reply({node}) {
	const [replying, setReplying] = useState(false)
	const [newComment, setNewComment] = useState("")

	if (replying) {
		return (
			<form onSubmit={(ev) => {
				ev.preventDefault()
				ev.stopPropagation()
				api.newComment(newComment, node.id).then((response) => {
					node.children.push(response.data)
					setReplying(false)
					setNewComment("")
				})
			}}>
				<textarea
					value={newComment}
					onInput={(ev) => setNewComment(ev.target.value)}
				/>
				<input type="submit" value="Reply!" />
				<div
					className="preview"
					dangerouslySetInnerHTML={{
						__html: T.previewComment(newComment),
					}}
				/>
			</form>
		)
	} else {
		return (
			<a onClick={(ev) => {
				ev.preventDefault()
				ev.stopPropagation()
				setReplying(true)
				setNewComment("")
			}}>
				Reply!
			</a>
		)
	}
}

// router
ReactDOM.render(document.getElementById("app"), (
	<BrowserRouter>
		<Route path="/" exact component={Home} />
		<Route path="/thread/:id" component={Thread} />
	</BrowserRouter>
))
