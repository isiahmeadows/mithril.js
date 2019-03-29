import {BrowserRouter, Link, Route} from "react-router"
import React, {useEffect, useLayoutEffect, useRef, useState} from "react"
import {api, demoSource} from "../threaditjs-common/common.mjs"
import ReactDOM from "react-dom"

// shared
function Header() {
	return <>
		<p className="head_links">
			<a href={demoSource("react-hooks")}>Source</a> | {""}
			<a href="http://threaditjs.com">ThreaditJS Home</a>
		</p>
		<h2><Link href="/">ThreaditJS: React</Link></h2>
	</>
}

function useAPI(init, callback, deps = []) {
	const [state, setState] = useState("loading")

	useEffect(() => {
		const controller = new AbortController()
		new Promise((resolve) => resolve(init(controller.signal)))
			.then((response) => {
				setState("ready")
				document.title = "ThreaditJS: React | Home"
				callback(response.data)
			}, (e) => {
				setState(e.status === 404 ? "notFound" : "error")
			})
		return () => controller.abort()
	}, deps) // eslint-disable-line react-hooks/exhaustive-deps

	return state
}

// home
function Home() {
	const [threads, setThreads] = useState([])
	const state = useAPI((signal) => api.home({signal}), (response) => {
		document.title = "ThreaditJS: React | Home"
		setThreads(response.data)
	}, [])

	return <>
		<Header />
		<div className="main">{(() => {
			switch (state) {
				case "loading":
					return <h2>Loading</h2>

				case "notFound":
					return <h2>Not found! Don&apos;t try refreshing!</h2>

				case "error":
					return <h2>Error! Try refreshing.</h2>

				default:
					return <>
						{threads.map((thread) =>
							<React.Fragment key={thread.id}>
								<p>
									<Link
										href={`/thread/${thread.id}`}
										dangerouslySetInnerHTML={{
											__html: T.trimTitle(thread.text)
										}}
									/>
								</p>
								<p className="comment_count">
									{thread.comment_count} comment(s)
								</p>
								<hr />
							</React.Fragment>
						)}
						<NewThread onSave={(thread) => {
							setThreads([...threads, thread])
						}} />
					</>
			}
		})()}</div>
	</>
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
			<textarea value={value} onInput={(ev) => setValue(ev.target.value)} />
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
	const state = useAPI(
		(signal) => api.thread(id, {signal}),
		({root: node}) => {
			document.title = `ThreaditJS: React | ${T.trimTitle(node.text)}`
			setNode(node)
		},
		[id]
	)

	return <>
		<Header />
		<div className="main">
			<React.Fragment key={id}>{(() => {
				switch (state) {
					case "loading":
						return <h2>Loading</h2>

					case "notFound":
						return <h2>Not found! Don&apos;t try refreshing!</h2>

					case "error":
						return <h2>Error! Try refreshing.</h2>

					default:
						return <ThreadNode node={node} />
				}
			})()}</React.Fragment>
		</div>
	</>
}

function ThreadNode({node}) {
	return (
		<div className="comment">
			<p dangerouslySetInnerHTML={{__html: node.text}} />
			<div className="reply"><Reply node={node} /></div>
			<div className="children">
				{node.children.map((child) => <ThreadNode key={child.id} node={child} />)}
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
				<textarea value={newComment} onInput={(ev) => {
					setNewComment(ev.target.value)
				}} />
				<input type="submit" value="Reply!" />
				<div className="preview" dangerouslySetInnerHTML={{
					__html: T.previewComment(newComment)
				}} />
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
