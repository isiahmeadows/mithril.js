import m from "mithril"
import * as api from "../api.mjs"
import Layout from "./Layout.jsx"
import ThreadNode from "./ThreadNode.jsx"

export default {
    oninit: () => T.time("Thread render"),
    oncreate: () => T.timeEnd("Thread render"),
    view: ({attrs}) => (
        <Layout
            key={attrs.id}
            load={async (signal) => {
                const {root} = await api.thread(attrs.id, {signal})
                document.title = `ThreaditJS: Mithril | ${T.trimTitle(root.text)}`
                return root
            }}
            view={(node) => <ThreadNode node={node} />}
        />
    ),
}
