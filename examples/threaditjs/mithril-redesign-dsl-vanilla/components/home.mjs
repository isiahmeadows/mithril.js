import {m, component} from "mithril"
import * as api from "../api.mjs"
import {Layout} from "./layout.mjs"
import {ThreadPreview} from "./thread-preview.mjs"
import {NewThread} from "./new-thread.mjs"

export const Home = component(() => m(Layout, {
    load: (signal) => api.home({signal}),
    view: (_, {data: threads}) => [
        m(document, {title: "ThreaditJS: Mithril | Home"}),
        m.each(threads, "id", (thread) => m(ThreadPreview, {thread})),
        m(NewThread, {on: {save(thread) { threads.push(thread) }}}),
    ]
}))
