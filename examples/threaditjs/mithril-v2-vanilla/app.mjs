import m from "mithril"

// API calls
T.time("Setup")

const api = {
    async home(opts) {
        T.timeEnd("Setup")
        return m.request("/threads", opts)
    },
    async thread(id, opts) {
        T.timeEnd("Setup")
        return T.transformResponse(
            await m.request("/threads/:id", {params: {id}, ...opts})
        )
    },
    async newThread(text, opts) {
        return m.request("/threads/create", {
            method: "POST",
            params: {text},
            ...opts,
        })
    },
    async newComment(text, id, opts) {
        return m.request("/threads/create", {
            method: "POST",
            params: {text, parent},
            ...opts,
        })
    },
}

// shared
const demoSource =
    "https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/" +
    "threaditjs/mithril-v2-jsx"

const Header = {
    view: () => [
        m("p.head_links", [
            m("a", {href: demoSource}, "Source"), " | ",
            m("a[href='http://threaditjs.com']", "ThreaditJS Home"),
        ]),
        m("h2", [
            m(m.route.Link, {href: "/"}, "ThreaditJS: Mithril"),
        ]),
    ]
}

function Layout({attrs}) {
    const controller = new AbortController()
    let state = "loading"
    let value

    attrs.load(controller.signal)
        .then((response) => {
            state = "ready"
            value = attrs.onLoad(response)
        }, (e) => {
            state = e.status === 404 ? "notFound" : "error"
        })
        .finally(m.redraw)

    function pageView() {
        switch (state) {
            case "loading": return m("h2", "Loading")
            case "notFound": return m("h2", "Not found! Don't try refreshing!")
            case "error": return m("h2", "Error! Try refreshing.")
            default: return attrs.view(value)
        }
    }

    return {
        onremove: () => controller.abort(),

        view: (vnode) => {
            attrs = vnode.attrs
            return [
                m(Header),
                m(".main", pageView()),
            ]
        },
    }
}

// home
var ThreadPreview = {
    // eslint-disable-next-line camelcase
    view: ({attrs: {thread: {id, text, comment_count}}}) => [
        m("p", m("a", {
            href: `/thread/${id}`,
            oncreate: m.route.link,
            innerHTML: T.trimTitle(text),
        })),
        m("p.comment_count", comment_count, " comment(s)"),
        m("hr"),
    ]
}

const Home = {
    view: () => m(Layout, {
        load: (signal) => api.home({signal}),
        onLoad: (response) => {
            document.title = "ThreaditJS: React | Home"
            return response.data
        },
        view: (threads) => [
            // eslint-disable-next-line camelcase
            threads.map((thread) =>
                m(ThreadPreview, {key: thread.id, thread})
            ),
            m(NewThread, {onSave(thread) {
                threads.push(thread)
            }})
        ]
    }),
}

function NewThread() {
    let value

    return {
        view: ({attrs}) => m("form", {onsubmit() {
            api.newThread(value)
                .then(({data: thread}) => {
                    value = ""
                    if (attrs.onSave) attrs.onSave(thread)
                })
                .finally(m.redraw)
            return false
        }}, [
            m("textarea", {value, oninput: (ev) => value = ev.target.value}),
            m("input[type=submit][value='Post!']"),
        ])
    }
}

// thread
const Thread = {
    oninit: () => T.time("Thread render"),
    oncreate: () => T.timeEnd("Thread render"),
    view: ({attrs}) => m(Layout, {
        key: attrs.id,
        load: (signal) => api.thread(attrs.id, {signal}),
        onLoad: (response) => {
            const title = T.trimTitle(response.root.text)
            document.title = `ThreaditJS: React | ${title}`
            return response.root
        },
        view: (node) => m(ThreadNode, {node}),
    }),
}

const ThreadNode = {
    view: ({attrs: {node}}) => m(".comment", [
        m("p", m.trust(node.text)),
        m(".reply", m(Reply, {node})),
        m(".children", node.children.map((child) =>
            m(ThreadNode, {key: child.id, node: child})
        )),
    ]),
}

function Reply() {
    let replying = false
    let newComment = ""

    return {
        view: ({attrs: {node}}) =>
            replying
                ? m("form", {onsubmit() {
                    api.newComment(newComment, node.id).then((response) => {
                        node.children.push(response.data)
                        replying = false; newComment = ""
                    })
                    return false
                }}, [
                    m("textarea", {
                        value: newComment,
                        oninput: (ev) => newComment = ev.target.value,
                    }),
                    m("input[type=submit][value='Reply!']"),
                    m(".preview", m.trust(T.previewComment(newComment))),
                ])
                : m("a", {onclick() {
                    replying = true; newComment = ""
                    return false
                }}, "Reply!")
    }
}

// router
m.route(document.getElementById("app"), "/", {
    "/": Home,
    "/thread/:id": Thread,
})
