import {m, component, isInitial, usePortal} from "mithril"
import * as api from "../api.mjs"
import {Layout} from "./Layout.jsx"
import {ThreadNode} from "./ThreadNode.jsx"

export default component("Thread", ({id}) => {
    if (isInitial()) T.time("Thread render")

    return [
        isInitial() && m.capture(() => T.timeEnd("Thread render")),
        m(Layout, {
            id,
            load: (signal) => api.thread(id, {signal}),
            view({root: node}) {
                const title = T.trimTitle(node.text)
                usePortal(document, {title: `ThreaditJS: Mithril | ${title}`})
                return m(ThreadNode, {node})
            },
        }),
    ]
})
