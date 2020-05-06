import {m} from "mithril"
import * as api from "../api.mjs"
import Layout from "./layout.mjs"
import ThreadPreview from "./thread-preview.mjs"
import NewThread from "./new-thread.mjs"

export default function Home() {
    return m(Layout, {
        async load(signal) {
            const {data} = await api.home({signal})
            document.title = "ThreaditJS: Mithril | Home"
            return data
        },
        view: (threads) => [
            m.each(threads, "id", (thread) => m(ThreadPreview, {thread})),
            m(NewThread, {on: {save(thread) { threads.push(thread) }}}),
        ]
    })
}
