import {m} from "mithril"
import * as api from "../api.mjs"
import Layout from "./Layout.jsx"
import ThreadNode from "./ThreadNode.jsx"

export default function Thread({id}, info) {
    if (info.isInitial()) T.time("Thread render")

    return <>
        {info.isInitial() && m.capture(() => T.timeEnd("Thread render"))}
        <Layout
            id={id}
            load={async (signal) => {
                const {root} = await api.thread(id, {signal})
                document.title = `ThreaditJS: Mithril | ${T.trimTitle(root.text)}`
                return root
            }}
            view={(node) => <ThreadNode node={node} />}
        />
    </>
}
