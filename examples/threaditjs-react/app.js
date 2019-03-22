// Mithril v3 (this): 179 lines.
// React: 242 lines.
// React + experimental Hooks: 210 lines.
// Totals exclude this header comment.
// Mithril v3 is ~26% smaller than React, ~15% smaller than React + hooks.
import {BrowserRouter, Link, Route} from "react-router"
import React from "react"
import ReactDOM from "react-dom"

T.time("Setup")

//API calls
const apiUrl = (ref) => T.apiUrl + ref
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
class Home extends React.Component {
	constructor(...args) {
		super(...args)
		this.state = {
			state: "loading",
			threads: [],
		}

		api.home().then((response) => {
			document.title = "ThreaditJS: React | Home"
			this.setState({
				state: "ready",
				threads: response.data,
			})
		}, (e) => {
			this.setState({
				state: e.status === 404 ? "notFound" : "error",
			})
		})
	}

	render() {
		const {state, threads} = this.state
		return <>
			<Header />
			<div className="main">{
				state === "loading" ? <h2>Loading</h2>
					: state === "notFound" ? <h2>Not found! Don't try refreshing!</h2>
						: state === "error" ? <h2>Error! Try refreshing.</h2>
							: <>
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
						this.setState({threads: [...threads, thread]})
					}} />
				</>
			}</div>
		</>
	}
}

class NewThread extends React.Component {
	constructor(...args) {
		super(...args)
		this.state = {
			value: "",
		}
	}

	render() {
		const {value} = this.state
		const {onSave} = this.props

		return (
			<form onSubmit={(ev) => {
				ev.preventDefault()
				ev.stopPropagation()
				api.newThread(value).then(({data: thread}) => {
					onSave(thread)
					this.setState({value: ""})
				})
			}}>
				<textarea value={value} onInput={(ev) => this.setState({
					value: ev.target.value,
				})} />
				<input type="submit" value="Post!" />
			</form>
		)
	}
}

//thread
class Thread extends React.Component {
	constructor(...args) {
		super(...args)
		this.state = {
			state: "loading",
			node: undefined,
		}

		T.time("Thread render")

		api.thread(this.props.id).then(({root: node}) => {
			document.title = `ThreaditJS: React | ${T.trimTitle(node.text)}`
			this.setState({state: "ready", node})
		}, (e) => {
			this.setState({state: e.status === 404 ? "notFound" : "error"})
		})
	}

	componentDidMount() {
		T.timeEnd("Thread render")
	}

	render() {
		const {state, node} = this.state
		const {id} = this.props
		return <>
			<Header />
			<div className="main"><React.Fragment key={id}>{
				state === "loading" ? <h2>Loading</h2>
					: state === "notFound" ? <h2>Not found! Don't try refreshing!</h2>
						: state === "error" ? <h2>Error! Try refreshing.</h2>
							: <ThreadNode node={node} />
			}</React.Fragment></div>
		</>
	}
}

function ThreadNode({node}) {
	return (
		<div className="comment">
			<p dangerouslySetInnerHTML={{__html: node.text}} />
			<div className="reply"><Reply node={node} /></div>
			<div className="children">
				{node.children.map((child) => <ThreadNode node={child} />)}
			</div>
		</div>
	)
}

class Reply extends React.Component {
	constructor(...args) {
		super(...args)
		this.state = {
			replying: false,
			newComment: "",
		}
	}

	render() {
		const {replying, newComment} = this.state
		const {node} = this.props

		if (replying) {
			return (
				<form onSubmit={(ev) => {
					ev.preventDefault()
					ev.stopPropagation()
					api.newComment(newComment, node.id).then((response) => {
						node.children.push(response.data)
						this.setState({replying: false, newComment: ""})
					})
				}}>
					<textarea value={newComment} onInput={(ev) => {
						this.setState({newComment: ev.target.value})
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
					ev.target.value
					this.setState({replying: true, newComment: ""})
				}}>
					Reply!
				</a>
			)
		}
	}
}

//router
ReactDOM.render(document.getElementById("app"), (
	<BrowserRouter>
		<Route path="/" exact component={Home} />
		<Route path="/thread/:id" component={Thread} />
	</BrowserRouter>
))
