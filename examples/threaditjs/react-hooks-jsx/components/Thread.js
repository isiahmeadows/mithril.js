import React, {useState, useRef, useLayoutEffect} from "react"
import api from "../api.js"
import Layout from "./Layout.js"
import ThreadNode from "./ThreadNode.js"

export default function Thread({id}) {
    const initPhase = useRef(0)

    if (initPhase.current === 0) {
        initPhase.current = 1
        T.time("Thread render")
    }

    useLayoutEffect(() => {
        if (initPhase.current === 1) {
            initPhase.current = 2
            T.timeEnd("Thread render")
        }
    }, [])

    const [node, setNode] = useState()

    return (
        <Layout
            key={id}
            load={(signal) => api.thread(id, {signal}).then(({root}) => {
                document.title = `ThreaditJS: React | ${T.trimTitle(root.text)}`
                setNode(root)
            })}
            render={() => <ThreadNode node={node} />}
        />
    )
}
