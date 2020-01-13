import {m} from "mithril"
import * as api from "../api.mjs"
import Layout from "./Layout.jsx"
import ThreadPreview from "./ThreadPreview.jsx"
import NewThread from "./NewThread.jsx"

export default function Home() {
    return <Layout
        load={async (signal) => {
            const {data} = await api.home({signal})
            document.title = "ThreaditJS: Mithril | Home"
            return data
        }}
        view={(threads) => <>
            {m.each(threads, "id", (thread) => (
                <ThreadPreview thread={thread} />
            ))}
            <NewThread onsave={(thread) => threads.push(thread)} />
        </>}
    />
}
