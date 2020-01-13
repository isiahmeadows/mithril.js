import React from "react"
import api from "../api.js"
import Layout from "./Layout.js"
import ThreadPreview from "./ThreadPreview.js"
import NewThread from "./NewThread.js"

export default class Home extends React.Component {
    state = {
        threads: [],
    }

    componentWillUnmount() {
        this.controller.abort()
    }

    render() {
        const {threads} = this.state

        return (
            <Layout
                load={async (signal) => {
                    const {data} = await api.home({signal})
                    document.title = "ThreaditJS: React | Home"
                    return data
                }}
                render={() => <>
                    {threads.map((thread) => (
                        <ThreadPreview key={thread.id} thread={thread} />
                    ))}
                    <NewThread onSave={(thread) => {
                        this.setState({threads: [...threads, thread]})
                    }} />
                </>}
            />
        )
    }
}
