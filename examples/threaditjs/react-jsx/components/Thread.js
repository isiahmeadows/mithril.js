import React from "react"
import api from "../api.js"
import Layout from "./Layout.js"
import ThreadNode from "./ThreadNode.js"

export default class Thread extends React.Component {
    state = {
        node: undefined,
    }

    constructor(...args) {
        super(...args)
        T.time("Thread render")
    }

    componentDidMount() {
        T.timeEnd("Thread render")
    }

    render() {
        const {node} = this.state
        const {id} = this.props
        return (
            <Layout
                key={id}
                load={async (signal) => {
                    const {root: node} = await api.thread(id, {signal})
                    document.title = `ThreaditJS: Mithril | ${T.trimTitle(node.text)}`
                    this.setState({node})
                }}
                render={() => <ThreadNode node={node} />}
            />
        )
    }
}
