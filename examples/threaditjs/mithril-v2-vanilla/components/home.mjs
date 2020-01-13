import m from "mithril"
import * as api from "../api.mjs"
import Layout from "./layout.mjs"
import ThreadPreview from "./thread-preview.mjs"
import NewThread from "./new-thread.mjs"

export default {
    view: () => m(Layout, {
        async load(signal) {
            const {data} = await api.home({signal})
            document.title = "ThreaditJS: Mithril | Home"
            return data
        },
        view: (threads) => [
            // eslint-disable-next-line camelcase
            threads.map((thread) =>
                m(ThreadPreview, {key: thread.id, thread})
            ),
            m(NewThread, {onSave(thread) { threads.push(thread) }})
        ]
    }),
}
