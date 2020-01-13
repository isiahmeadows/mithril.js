import m from "mithril"
import * as api from "../api.mjs"

export default function Reply() {
    let newComment

    return {
        view: ({attrs: {node}}) =>
            newComment != null
                ? m("form", {onsubmit() {
                    api.newComment(newComment, node.id).then((response) => {
                        node.children.push(response.data)
                        newComment = null
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
                : m("a", {onclick() { newComment = "" }}, "Reply!"),
    }
}
