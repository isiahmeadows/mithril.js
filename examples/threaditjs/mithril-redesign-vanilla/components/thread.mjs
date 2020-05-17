import {m} from "mithril"
import * as api from "../api.mjs"
import Layout from "./layout.mjs"
import ThreadNode from "./thread-node.mjs"

export default function Thread({id}, info) {
    if (info.isInitial()) T.time("Thread render")

    return [
        info.isInitial() && m.whenReady(() => T.timeEnd("Thread render")),
        m(Layout, {
            id,
            async load(signal) {
                const {root} = await api.thread(id, {signal})
                document.title = `ThreaditJS: Mithril | ${T.trimTitle(root.text)}`
                return root
            },
            view: (node) => m(ThreadNode, {node}),
        }),
    ]
}
