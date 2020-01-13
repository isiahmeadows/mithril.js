import m from "mithril"
import Reply from "./reply.mjs"

export default {
    view: ({tag: ThreadNode, attrs: {node}}) => m(".comment", [
        m("p", m.trust(node.text)),
        m(".reply", m(Reply, {node})),
        m(".children", node.children.map((child) =>
            m(ThreadNode, {key: child.id, node: child})
        )),
    ]),
}
