import {m, component, linkTo} from "mithril"

export const ThreadPreview = component(({thread}) => {
    const title = T.trimTitle(thread.text)
    return [
        m("p", m("a", linkTo(`/thread/${thread.id}`), {innerHTML: title})),
        // eslint-disable-next-line camelcase
        m("p.comment_count", thread.comment_count, " comment(s)"),
        m("hr"),
    ]
})
