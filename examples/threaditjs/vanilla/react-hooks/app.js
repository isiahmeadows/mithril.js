import {BrowserRouter, Link, Route} from "react-router"
import React, {useEffect, useLayoutEffect, useRef, useState} from "react"
import {api, demoSource} from "../threaditjs-common/common.mjs"
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

function Layout({load, onLoad, children}) {
	const [view, setView] = useState(h("h2", "Loading"))

	useEffect(() => {
		const controller = new AbortController()
		new Promise((resolve) => resolve(load(controller.signal)))
			.then((response) => {
				setView(children)
				onLoad(response)
			}, (e) => {
				setView(e.status === 404
					? h("h2", "Not found! Don't try refreshing!")
					: h("h2", "Error! Try refreshing."))
			})
		return () => controller.abort()
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	return h(React.Fragment, null,
		h(Header, null),
		h("div", {className: "main"}, view)
	)
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

function Home() {
	const [threads, setThreads] = useState([])

	return h(Layout, {
		load: (signal) => api.home({signal}),
		onLoad: (response) => {
			document.title = "ThreaditJS: React | Home"
			setThreads(response.data)
		},
	},
		threads.map((thread) => h(ThreadPreview, {key: thread.id, thread})),
		h(NewThread, {onSave: (thread) => setThreads([...threads, thread])})
	)
}

function NewThread({onSave}) {
	const [value, setValue] = useState("")

	return h("form", {onSubmit: (ev) => {
		ev.preventDefault()
		ev.stopPropagation()
		api.newThread(value).then(({data: thread}) => {
			if (onSave) onSave(thread)
			setValue("")
		})
	}},
		h("textarea", {value, onInput: (ev) => setValue(ev.target.value)}),
		h("input", {type: "submit", value: "Post!"})
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

	return h(Layout, {
		key: id,
		load: (signal) => api.thread(id, {signal}),
		onLoad: ({root: node}) => {
			document.title = `ThreaditJS: React | ${T.trimTitle(node.text)}`
			setNode(node)
		},
	},
		h(ThreadNode, {node})
	)
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

function Reply({node}) {
	const [replying, setReplying] = useState(false)
	const [newComment, setNewComment] = useState("")

	if (replying) {
		return h("form", {onSubmit: (ev) => {
			ev.preventDefault()
			ev.stopPropagation()
			api.newComment(newComment, node.id).then((response) => {
				node.children.push(response.data)
				setReplying(false)
				setNewComment("")
			})
		}},
			h("textarea", {value: newComment, onInput: (ev) => {
				setNewComment(ev.target.value)
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
			setReplying(true)
			setNewComment("")
		}}, "Reply!")
	}
}

// router
ReactDOM.render(document.getElementById("app"),
	h(BrowserRouter, null,
		h(Route, {path: "/", exact: true, component: Home}),
		h(Route, {path: "/thread/:id", component: Thread})
	)
)
