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
    return [
        m("p.head_links", [
            m("a", {href: demoSource}, "Source"), " | ",
            m("a[href='http://threaditjs.com']", "ThreaditJS Home"),
        ]),
        m("h2", m("a", linkTo("/"), "ThreaditJS: Mithril")),
    ]
}

function Layout(ctrl, attrs) {
    const current = ctrl.await((signal) =>
        attrs.load(signal).then((value) => attrs.on.load(value))
    )

    function getChildren(nextAttrs) {
        attrs = nextAttrs
        switch (current.fetch().state) {
            case "pending": return m("h2", "Loading")
            case "ready": return [].concat(nextAttrs.view())
            default:
                return current.value.status === 404
                    ? m("h2", "Not found! Don't try refreshing!")
                    : m("h2", "Error! Try refreshing.")
        }
    }

    return (nextAttrs) => [
        m(Header),
        m("div.main", getChildren(nextAttrs)),
    ]
}

// home
// eslint-disable-next-line camelcase
function ThreadPreview(ctrl, {thread: {id, text, comment_count}}) {
    return [
        m("p", m("a", linkTo(`/thread/${id}`), {innerHTML: T.trimTitle(text)})),
        m("p.comment_count", comment_count, " comment(s)"),
        m("hr"),
    ]
}

function Home() {
    let threads

    return () => m(Layout, {
        load: (signal) => api.home({signal}),
        on: {load: (response) => threads = response.data},
        view: () => [
            m.each(threads, "id", (thread) => m(ThreadPreview, {thread})),
            m(NewThread, {on: {save(thread) { threads.push(thread) }}}),
        ]
    })
}

function NewThread() {
    const textarea = m.ref()

    return (attrs) => m("form", [
        m("textarea", m.capture(textarea)),
        m("input[type=submit][value='Post!']"),
        {on: {async submit(_, capture) {
            capture.event()
            const {data: thread} = await api.newThread(textarea.get().value)
            textarea.get().value = ""
            attrs.on.save(thread)
        }}},
    ])
}

// thread
function Thread(ctrl) {
    T.time("Thread render")
    ctrl.afterCommit(() => T.timeEnd("Thread render"))
    let node

    return ({id}) => m.link(id, m(Layout, {
        load: (signal) => api.thread(id, {signal}),
        on: {load({root}) {
            node = root
            document.title = `ThreaditJS: Mithril | ${T.trimTitle(root.text)}`
        }},
        view: () => m(ThreadNode, {node}),
    }))
}

function ThreadNode(ctrl, {node}) {
    return m("div.comment", [
        m("p", {innerHTML: node.text}),
        m("div.reply", m(Reply, {node})),
        m("div.children", m.each(node.children, "id",
            (child) => m(ThreadNode, {node: child})
        )),
    ])
}

function Reply() {
    const textarea = m.ref()
    let isOpen = false
    let preview

    return ({node}) => isOpen
        ? m("form", [
            m("textarea", m.capture(textarea), {on: {input() {
                preview = T.previewComment(textarea.value)
            }}}),
            m("input[type=submit][value='Reply!']"),
            m("div.preview", {innerHTML: preview}),
            {on: {async submit(_, capture) {
                capture.event()
                const value = textarea.value
                const {data} = await api.newComment(value, node.id)
                node.children.push(data)
                isOpen = false
            }}}
        ])
        : m("a", "Reply!", {on: {click(capture) {
            capture.event()
            isOpen = true
        }}})
}

// router
const router = new Router(DOM)

render("#app", () => router.match(
    ["/", () => m(Home)],
    ["/thread:id", ({id}) => m(Thread, {id})],
))
