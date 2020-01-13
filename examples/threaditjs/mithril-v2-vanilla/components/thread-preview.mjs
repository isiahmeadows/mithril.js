import m from "mithril"

export default {
    // eslint-disable-next-line camelcase
    view: ({attrs: {thread: {id, text, comment_count}}}) => [
        m("p", m("a", {
            href: `/thread/${id}`,
            oncreate: m.route.link,
            innerHTML: T.trimTitle(text),
        })),
        m("p.comment_count", comment_count, " comment(s)"),
        m("hr"),
    ],
}
