import {BrowserRouter, Link, Route} from "react-router"
import {api, demoSource} from "../threaditjs-common/common.mjs"
import React from "react"
import ReactDOM from "react-dom"
const h = React.createComponent

// shared
function Header() {
	return h(React.Fragment, null,
		h("p", {className: "head_links"},
			h("a", {href: demoSource("react")}, "Source"), " | ",
			h("a", {href: "http://threaditjs.com"}, "ThreaditJS Home")
		),
		h("h2", h(Link, {href: "/"}, "ThreaditJS: React"))
	)
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
			case "loading": return h("h2", "Loading")
			case "notFound": return h("h2", "Not found! Don't try refreshing!")
			case "error": return h("h2", "Error! Try refreshing.")
			default: return this.props.children
		}
	}

	render() {
		return h(React.Fragment, null,
			h(Header, null),
			h("div", {className: "main"}, this.renderPage())
		)
	}
}

// home
function ThreadPreview({thread: {id, text, comment_count}}) {
	return h(React.Fragment, null,
		h("p", h(Link, {
			href: `/thread/${id}`,
			dangerouslySetInnerHTML: {__html: T.trimTitle(text)},
		})),
		h("p", {className: "comment_count"}, comment_count, " comment(s)"),
		h("hr")
	)
}

class Home extends React.Component {
	constructor(...args) {
		super(...args)
		this.state = {
			threads: [],
		}
	}

	render() {
		const {threads} = this.state

		return h(Layout, {
			load: (signal) => api.home({signal}),
			onLoad: (response) => {
				document.title = "ThreaditJS: React | Home"
				this.setState({threads: response.data})
			},
		},
			threads.map((thread) => h(ThreadPreview, {key: thread.id, thread})),
			h(NewThread, {onSave: (thread) => {
				this.setState({threads: [...threads, thread]})
			}})
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

		return h("form", {onSubmit: (ev) => {
			ev.preventDefault()
			ev.stopPropagation()
			api.newThread(value).then(({data: thread}) => {
				if (onSave) onSave(thread)
				this.setState({value: ""})
			})
		}},
			h("textarea", {value, onInput: (ev) => {
				this.setState({value: ev.target.value})
			}}),
			h("input", {type: "submit", value: "Post!"})
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
		const {node} = this.state
		const {id} = this.props
		return h(Layout, {
			key: id,
			load: (signal) => api.thread(id, {signal}),
			onLoad: ({root: node}) => {
				const title = T.trimTitle(node.text)
				document.title = `ThreaditJS: React | ${title}`
				this.setState({node})
			},
		},
			h(ThreadNode, {node})
		)
	}
}

function ThreadNode({node}) {
	return (
		h("div", {className: "comment"},
			h("p", {dangerouslySetInnerHTML: {__html: node.text}}),
			h("div", {className: "reply"}, h(Reply, {node})),
			h("div", {className: "children"},
				node.children.map((child) =>
					h(ThreadNode, {key: child.id, node: child})
				)
			)
		)
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
			return h("form", {onSubmit: (ev) => {
				ev.preventDefault()
				ev.stopPropagation()
				api.newComment(newComment, node.id).then((response) => {
					node.children.push(response.data)
					this.setState({replying: false, newComment: ""})
				})
			}},
				h("textarea", {value: newComment, onInput: (ev) => {
					this.setState({newComment: ev.target.value})
				}}),
				h("input", {type: "submit", value: "Reply!"}),
				h("div", {className: "preview", dangerouslySetInnerHTML: {
					__html: T.previewComment(newComment),
				}})
			)
		} else {
			return h("a", {onClick: (ev) => {
				ev.preventDefault()
				ev.stopPropagation()
				this.setState({replying: true, newComment: ""})
			}}, "Reply!")
		}
	}
}

// router
ReactDOM.render(document.getElementById("app"),
	h(BrowserRouter, null,
		h(Route, {path: "/", exact: true, component: Home}),
		h(Route, {path: "/thread/:id", component: Thread})
	)
)
