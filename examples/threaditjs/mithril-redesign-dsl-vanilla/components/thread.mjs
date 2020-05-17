import {m, component, isInitial, whenReady} from "mithril"
import * as api from "../api.mjs"
import {Layout} from "./Layout.jsx"
import {ThreadNode} from "./ThreadNode.jsx"

export default component("Thread", ({id}) => {
    if (isInitial()) {
        T.time("Thread render")
        whenReady(() => T.timeEnd("Thread render"))
    }

    return m(Layout, {
        id,
        load: (signal) => api.thread(id, {signal}),
        view({root: node}) {
            const title = T.trimTitle(node.text)
            document.title = `ThreaditJS: Mithril | ${title}`
            return m(ThreadNode, {node})
        },
    })
})
