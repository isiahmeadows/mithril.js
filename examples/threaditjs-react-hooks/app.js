// Mithril v3: 163 lines.
// React: 242 lines.
// React + experimental Hooks (this): 210 lines.
// Totals exclude this header comment.
// Mithril v3 is ~33% smaller than React, ~22% smaller than React + hooks.
import React, {useEffect, useState} from "react"
import ReactDOM from "react-dom"
import {Router, Link} from "react-router"

T.time("Setup")

//API calls
const apiUrl = ref => T.apiUrl + ref
const api = {
	async home() {
		T.timeEnd("Setup")
		const response = await fetch(apiUrl("/threads"))
		await response.json()
	},
	async thread(id) {
		T.timeEnd("Setup")
		id = encodeURIComponent(id)
		const response = await fetch(apiUrl(`/comments/${id}`))
		return T.transformResponse(await response.json())
	},
	async newThread(text) {
		text = encodeURIComponent(text)
		const response = await fetch(
			apiUrl(`/threads/create?text=${text}`),
			{method: "POST"}
		)
		return response.json()
	},
	async newComment(text, id) {
		id = encodeURIComponent(id)
		text = encodeURIComponent(text)
		const response = await fetch(
			apiUrl(`/comments/create?text=${text}&parent=${id}`),
			{method: "POST"}
		)
		return response.json()
	}
}

//shared
const demoSource =
	"https://github.com/MithrilJS/mithril.js/tree/master/examples/threaditjs-react"
function Header() {
	return <>
		<p className="head_links">
			<a href={demoSource}>Source</a> | {""}
			<a href="http://threaditjs.com">ThreaditJS Home</a>
		</p>
		<h2><Link href="/">ThreaditJS: React</Link></h2>
	</>
}

//home
function Home() {
	const [state, setState] = useState("loading")
	const [threads, setThreads] = useState([])

	useEffect(() => {
		api.home().then(response => {
			document.title = "ThreaditJS: React | Home"
			setState("ready")
			setThreads(response.data)
		}, e => {
			setState(e.status === 404 ? "notFound" : "error")
		})
	}, [])

	return <>
		<Header />
		<div class="main">{
			state === "loading" ? <h2>Loading</h2>
			: state === "notFound" ? <h2>Not found! Don't try refreshing!</h2>
			: state === "error" ? <h2>Error! Try refreshing.</h2>
			: <>
				{threads.map(thread =>
					<React.Fragment key={thread.id}>
						<p>
							<Link
								href={`/thread/${thread.id}`}
								dangerouslySetInnerHTML={{
									__html: T.trimTitle(thread.text)
								}}
							/>
						</p>
						<p class="comment_count">
							{thread.comment_count} comment(s)
						</p>
						<hr />
					</React.Fragment>
				)}
				<NewThread onSave={thread => {
					setThreads([...threads, thread])
				}} />
			</>
		}</div>
	</>
}

function NewThread({save}) {
	const [value, setValue] = useState("")

	return (
		<form onSubmit={ev => {
			ev.preventDefault()
			ev.stopPropagation()
			api.newThread(value).then(({data: thread}) => {
				onSave(thread)
				setValue("")
			})
		}}>
			<textarea value={value} onInput={ev => setValue(ev.target.value)} />
			<input type="submit" value="Post!" />
		</form>
	)
}

//thread
function Thread({id}) {
	const isInit = useRef(true)

	if (isInit.current) {
		isInit.current = false
		T.time("Thread render")
	}

	useLayoutEffect(() => {
		T.timeEnd("Thread render")
	}, [])

	const [state, setState] = useState("loading")
	const [node, setNode] = useState()

	useEffect(() => {
		api.thread(id).then(({root: node}) => {
			document.title = `ThreaditJS: React | ${T.trimTitle(node.text)}`
			setState("ready")
			setNode(node)
		}, e => {
			setState(e.status === 404 ? "notFound" : "error")
		})
	}, [])

	return <>
		<Header />
		<div class="main"><React.Fragment key={id}>{
			state === "loading" ? <h2>Loading</h2>
			: state === "notFound" ? <h2>Not found! Don't try refreshing!</h2>
			: state === "error" ? <h2>Error! Try refreshing.</h2>
			: <ThreadNode node={node} />
		}</React.Fragment></div>
	</>
}

function ThreadNode({node}) {
	return (
		<div class="comment">
			<p dangerouslySetInnerHTML={{__html: node.text}} />
			<div class="reply"><Reply node={node} /></div>
			<div class="children">
				{node.children.map(child => <ThreadNode node={child} />)}
			</div>
		</div>
	)
}

function Reply(context, {node}, {replying = false, newComment = ""} = {}) {
	const [replying, setReplying] = useState(false)
	const [newComment, setNewComment] = useState("")

	if (replying) {
		return (
			<form onSubmit={ev => {
				ev.preventDefault()
				ev.stopPropagation()
				api.newComment(newComment, node.id).then(response => {
					node.children.push(response.data)
					setReplying(false)
					setNewComment("")
				})
			}}>
				<textarea value={newComment} onInput={ev => {
					setNewComment(ev.target.value)
				}} />
				<input type="submit" value="Reply!" />
				<div class="preview" dangerouslySetInnerHTML={{
					__html: T.previewComment(newComment)
				}} />
			</form>
		)
	} else {
		return (
			<a onClick={ev => {
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

//router
React.render(document.getElementById("app"), (
	<BrowserRouter>
		<Route path="/" exact component={Home} />
		<Route path="/thread/:id" component={Thread} />
	</BrowserRouter>
))
