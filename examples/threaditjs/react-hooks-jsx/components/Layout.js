import React, {useState, useEffect} from "react"
import Header from "./Header"

export default function Layout({load, onLoad, render}) {
    const [[state, value], set] = useState(["pending"])

    useEffect(() => {
        const controller = new AbortController()
        new Promise((resolve) => resolve(onLoad(controller.signal))).then(
            (response) => set(["ready", response]),
            (e) => set([e.status === 404 ? "missing" : "error", null])
        )
        return () => controller.abort()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    let view

    switch (state) {
    case "pending": view = <h2>Loading</h2>; break
    case "ready": view = render(value); break
    case "missing": view = <h2>Not found! Don&apos;t try refreshing!</h2>; break
    case "error": view = <h2>Error! Try refreshing.</h2>; break
    }

    return <>
        <Header />
        <div className="main">{view}</div>
    </>
}
