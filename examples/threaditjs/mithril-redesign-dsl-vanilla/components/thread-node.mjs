import {m, component} from "mithril"
import Reply from "./Reply.mjs"

export const ThreadNode = component(({node}) => (
    m("div.comment",
        m("p", {innerHTML: node.text}),
        m("div.reply", m(Reply, {node})),
        m("div.children", m.each(node.children, "id",
            (child) => m(ThreadNode, {node: child})
        )),
    )
))
