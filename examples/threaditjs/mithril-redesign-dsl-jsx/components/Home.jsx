import {m, component, usePortal} from "mithril"
import * as api from "../api.mjs"
import {Layout} from "./Layout.jsx"
import {ThreadPreview} from "./ThreadPreview.jsx"
import {NewThread} from "./NewThread.jsx"

export const Home = component(() => (
    <Layout
        load={(_, signal) => api.home({signal})}
        view={({data: threads}) => {
            usePortal(document, {title: "ThreaditJS: Mithril | Home"})

            return <>
                {m.each(threads, "id", (thread) => (
                    <ThreadPreview thread={thread} />
                ))}
                <NewThread onsave={(thread) => threads.push(thread)} />
            </>
        }}
    />
))
