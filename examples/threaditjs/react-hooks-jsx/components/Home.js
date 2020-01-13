import React, {useState} from "react"
import api from "../api.js"
import Layout from "./Layout.js"
import ThreadPreview from "./ThreadPreview.js"
import NewThread from "./NewThread.js"

export default function Home() {
    const [threads, setThreads] = useState([])

    return (
        <Layout
            load={(signal) => api.home({signal}).then((response) => {
                document.title = "ThreaditJS: React | Home"
                setThreads(response.data)
            })}
            render={() => <>
                {threads.map((thread) => (
                    <ThreadPreview key={thread.id} thread={thread} />
                ))}
                <NewThread onSave={(thread) => setThreads([...threads, thread])} />
            </>}
        />
    )
}
