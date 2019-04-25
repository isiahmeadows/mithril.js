import {BrowserRouter, Link, Route} from "react-router"
import {api, demoSource} from "../threaditjs-common/common.mjs"
import React from "react"
import ReactDOM from "react-dom"

// shared
function Header() {
	return <>
		<p className="head_links">
			<a href={demoSource("react")}>Source</a> | {""}
			<a href="http://threaditjs.com">ThreaditJS Home</a>
		</p>
		<h2><Link href="/">ThreaditJS: React</Link></h2>
	</>
}

class Layout extends React.Component {
	constructor(...args) {
		super(...args)
		this.state = {state: "loading"}
		this.controller = new AbortController()

		this.props.load(this.controller.signal).then((response) => {
			document.title = "ThreaditJS: React | Home"
			this.setState({state: "ready"})
			this.props.onLoad(response)
		}, (e) => {
			this.setState({
				state: e.status === 404 ? "notFound" : "error",
			})
		})
	}

	componentWillUnmount() {
		this.controller.abort()
	}

	renderPage() {
		switch (this.state.state) {
			case "loading":
				return <h2>Loading</h2>

			case "notFound":
				return <h2>Not found! Don&apos;t try refreshing!</h2>

			case "error":
				return <h2>Error! Try refreshing.</h2>

			default:
				return this.props.children
		}
	}

	render() {
		return <>
			<Header />
			<div className="main">{this.renderPage()}</div>
		</>
	}
}

// home
function ThreadPreview({thread: {id, text, comment_count}}) {
	return <>
		<p>
			<Link
				href={`/thread/${id}`}
				dangerouslySetInnerHTML={{__html: T.trimTitle(text)}}
			/>
		</p>
		<p className="comment_count">{comment_count} comment(s)</p>
		<hr />
	</>
}

class Home extends React.Component {
	constructor(...args) {
		super(...args)
		this.state = {
			threads: [],
		}
	}

	componentWillUnmount() {
		this.controller.abort()
	}

	render() {
		const {state, threads} = this.state

		return (
			<Layout
				load={(signal) => api.home({signal})}
				onLoad={(response) => {
					document.title = "ThreaditJS: React | Home"
					this.setState({threads: response.data})
				}}
			>
				{threads.map((thread) => (
					<ThreadPreview key={thread.id} thread={thread} />
				))}
				<NewThread onSave={(thread) => {
					this.setState({threads: [...threads, thread]})
				}} />
			</Layout>
		)
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
					if (onSave) onSave(thread)
					this.setState({value: ""})
				})
			}}>
				<textarea value={value} onInput={(ev) => {
					this.setState({value: ev.target.value})
				}} />
				<input type="submit" value="Post!" />
			</form>
		)
	}
}

// thread
class Thread extends React.Component {
	constructor(...args) {
		super(...args)
		this.state = {
			node: undefined,
		}
		T.time("Thread render")
	}

	componentDidMount() {
		T.timeEnd("Thread render")
	}

	render() {
		const {state, node} = this.state
		const {id} = this.props
		return (
			<Layout
				key={id}
				load={(signal) => api.thread(id, {signal})}
				onLoad={({root: node}) => {
					const title = T.trimTitle(node.text)
					document.title = `ThreaditJS: React | ${title}`
					this.setState({node})
				}}
			>
				<ThreadNode node={node} />
			</Layout>
		)
	}
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
						__html: T.previewComment(newComment),
					}} />
				</form>
			)
		} else {
			return (
				<a onClick={(ev) => {
					ev.preventDefault()
					ev.stopPropagation()
					this.setState({replying: true, newComment: ""})
				}}>
					Reply!
				</a>
			)
		}
	}
}

// router
ReactDOM.render(document.getElementById("app"), (
	<BrowserRouter>
		<Route path="/" exact component={Home} />
		<Route path="/thread/:id" component={Thread} />
	</BrowserRouter>
))
