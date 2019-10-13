import {DOM, Router, linkTo, m, p, render, request} from "mithril"

// API calls
T.time("Setup")

const api = {
    async home(opts) {
        T.timeEnd("Setup")
        return request("/threads", opts)
    },
    async thread(id, opts) {
        T.timeEnd("Setup")
        return T.transformResponse(
            await request(p("/threads/:id", {id}), opts)
        )
    },
    async newThread(text, opts) {
        return request(p("/threads/create", {text}), {method: "POST", ...opts})
    },
    async newComment(text, id, opts) {
        return request(
            p("/threads/create", {text, parent}),
            {method: "POST", ...opts}
        )
    },
}

// shared
const demoSource =
    "https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/" +
    "threaditjs/mithril-redesign-vanilla"

function Header() {
    return <>
        <p class="head_links">
            <a href={demoSource}>Source</a> | {}
            <a href="http://threaditjs.com">ThreaditJS Home</a>
        </p>
        <h2><a>{linkTo("/")}ThreaditJS: Mithril</a></h2>
    </>
}

function Layout(ctrl, attrs) {
    const current = ctrl.await((signal) =>
        attrs.load(signal).then((value) => attrs.on.load(value))
    )

    function getChildren(nextAttrs) {
        attrs = nextAttrs
        switch (current.fetch().state) {
            case "pending": return <h2>Loading</h2>
            case "ready": return [].concat(nextAttrs.view())
            default:
                return current.value.status === 404
                    ? <h2>Not found! Don't try refreshing!</h2>
                    : <h2>Error! Try refreshing.</h2>
        }
    }

    return (nextAttrs) => <>
        <Header />
        <div class="main">{getChildren(nextAttrs)}</div>
    </>
}

// home
// eslint-disable-next-line camelcase
function ThreadPreview(ctrl, {thread: {id, text, comment_count}}) {
    return <>
        <p><a {...linkTo(`/thread/${id}`)} innerHTML={T.trimTitle(text)} /></p>
        {/* eslint-disable-next-line camelcase */}
        <p class="comment_count">{comment_count} comment(s)</p>
        <hr />
    </>
}

function Home() {
    let threads

    return () => <Layout
        load={(signal) => api.home({signal})}
        on={{load(response) { threads = response.data }}}
        view={() => <>
            {m.each(threads, "id",
                (thread) => <ThreadPreview thread={thread} />
            )}
            <NewThread on={{save(thread) { threads.push(thread) }}} />
        </>}
    />
}

function NewThread() {
    const textarea = m.ref()

    return ({on}) => <form on={{async submit(_, capture) {
        capture.event()
        const {data: thread} = await api.newThread(textarea.current.value)
        textarea.current.value = ""
        on.save(thread)
    }}}>
        <textarea {...m.capture(textarea)} />
        <input type="submit" value="Post!" />
    </form>
}

// thread
function Thread(ctrl) {
    T.time("Thread render")
    ctrl.afterCommit(() => T.timeEnd("Thread render"))
    let node

    return ({id}) => m.link(id,
        <Layout
            load={(signal) => api.thread(id, {signal})}
            on={{load({root}) {
                node = root
                document.title = "ThreaditJS: Mithril | " +
                    T.trimTitle(root.text)
            }}}
            view={() => <ThreadNode node={node} />}
        />
    )
}

function ThreadNode(ctrl, {node}) {
    return (
        <div class="comment">
            <p innerHTML={node.text} />
            <div class="reply"><Reply node={node} /></div>
            <div class="children">
                {m.each(node.children, "id",
                    (child) => <ThreadNode node={child} />
                )}
            </div>
        </div>
    )
}

function Reply() {
    const textarea = m.ref()
    let isOpen = false
    let preview

    return ({node}) => isOpen
        ? (
            <form on={{async submit(_, capture) {
                capture.event()
                const value = textarea.value
                const {data} = await api.newComment(value, node.id)
                node.children.push(data)
                isOpen = false
            }}}>
                <textarea {...m.capture(textarea)} on={{input() {
                    preview = T.previewComment(textarea.value)
                }}} />
                <input type="submit" value="Reply!" />
                <div class="preview" innerHTML={preview} />
            </form>
        )
        : (
            <a on={{click(capture) { capture.event(); isOpen = true }}}>
                Reply!
            </a>
        )
}

// router
const router = new Router(DOM)

render("#app", () => router.match(
    ["/", () => <Home />],
    ["/thread:id", ({id}) => <Thread id={id} />],
))
