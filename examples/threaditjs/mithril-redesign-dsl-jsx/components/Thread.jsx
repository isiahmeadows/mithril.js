import {m, component, whenReady, isInitial, usePortal} from "mithril"
import * as api from "../api.mjs"
import {Layout} from "./Layout.jsx"
import {ThreadNode} from "./ThreadNode.jsx"

export const Thread = component(({id}) => {
    if (isInitial()) {
        T.time("Thread render")
        whenReady(() => T.timeEnd("Thread render"))
    }

    return <Layout
        id={id}
        load={(_, signal) => api.thread(id, {signal})}
        view={({root: node}) => {
            const title = T.trimTitle(node.text)
            usePortal(document, {title: `ThreaditJS: Mithril | ${title}`})
            return <ThreadNode node={node} />
        }}
    />
})
