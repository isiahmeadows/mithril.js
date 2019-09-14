import {BrowserRouter, Link, Route} from "react-router"
import React from "react"
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
    "threaditjs/react"

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

class Layout extends React.Component {
    state = {
        state: "loading",
    }
    controller = new AbortController()

    componentDidMount() {
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
                return this.props.render()
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

class Home extends React.Component {
    state = {
        threads: [],
    }

    componentWillUnmount() {
        this.controller.abort()
    }

    render() {
        const {threads} = this.state

        return (
            <Layout
                load={(signal) => api.home({signal})}
                onLoad={(response) => {
                    document.title = "ThreaditJS: React | Home"
                    this.setState({threads: response.data})
                }}
                render={() => <>
                    {threads.map((thread) => (
                        <ThreadPreview key={thread.id} thread={thread} />
                    ))}
                    <NewThread onSave={(thread) => {
                        this.setState({threads: [...threads, thread]})
                    }} />
                </>}
            />
        )
    }
}

class NewThread extends React.Component {
    state = {
        value: "",
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
    state = {
        node: undefined,
    }

    constructor(...args) {
        super(...args)
        T.time("Thread render")
    }

    componentDidMount() {
        T.timeEnd("Thread render")
    }

    render() {
        const {node} = this.state
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
                render={() => <ThreadNode node={node} />}
            />
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
    state = {
        replying: false,
        newComment: "",
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
