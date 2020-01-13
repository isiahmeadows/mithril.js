import React from "react"
import Header from "./Header"

export default class Layout extends React.Component {
    state = {
        state: "loading",
        value: null,
    }
    controller = new AbortController()

    componentDidMount() {
        this.props.load(this.controller.signal).then((value) => {
            document.title = "ThreaditJS: React | Home"
            this.setState({state: "ready", value})
        }, (e) => {
            this.setState({state: e.status === 404 ? "notFound" : "error"})
        })
    }

    componentWillUnmount() {
        this.controller.abort()
    }

    renderPage() {
        switch (this.state.state) {
        case "loading":
            return <h2>Loading</h2>

        case "notFound":
            return <h2>Not found! Don&apos;t try refreshing!</h2>

        case "error":
            return <h2>Error! Try refreshing.</h2>

        default:
            return this.props.render(this.state.value)
        }
    }

    render() {
        return <>
            <Header />
            <div className="main">{this.renderPage()}</div>
        </>
    }
}
