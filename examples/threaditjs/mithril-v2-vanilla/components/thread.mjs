import m from "mithril"
import * as api from "../api.mjs"
import Layout from "./layout.mjs"
import ThreadNode from "./thread-node.mjs"

export default {
    oninit: () => T.time("Thread render"),
    oncreate: () => T.timeEnd("Thread render"),
    view: ({attrs}) => m(Layout, {
        key: attrs.id,
        async load(signal) {
            const {root} = await api.thread(attrs.id, {signal})
            document.title = `ThreaditJS: Mithril | ${T.trimTitle(root.text)}`
            return root
        },
        view: (node) => m(ThreadNode, {node}),
    }),
}
