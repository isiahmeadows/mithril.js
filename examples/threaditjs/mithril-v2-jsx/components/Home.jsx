import m from "mithril"
import * as api from "../api.mjs"
import Layout from "./Layout.jsx"
import ThreadPreview from "./ThreadPreview.jsx"
import NewThread from "./NewThread.jsx"

export default {
    view: () => (
        <Layout
            load={async (signal) => {
                const {data} = await api.home({signal})
                document.title = "ThreaditJS: Mithril | Home"
                return data
            }}
            view={(threads) => <>
                // eslint-disable-next-line camelcase
                {threads.map((thread) =>
                    <ThreadPreview key={thread.id} thread={thread} />
                )}
                <NewThread onSave={(thread) => {
                    threads.push(thread)
                }} />
            </>}
        />
    ),
}
