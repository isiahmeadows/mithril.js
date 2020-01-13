import {m} from "mithril"
import Reply from "./reply.mjs"

export default function ThreadNode({node}) {
    return m("div.comment",
        m("p", {innerHTML: node.text}),
        m("div.reply", m(Reply, {node})),
        m("div.children", m.each(node.children, "id",
            (child) => m(ThreadNode, {node: child})
        )),
    )
}
