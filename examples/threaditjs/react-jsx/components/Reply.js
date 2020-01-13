import React from "react"
import api from "../api.js"

export default class Reply extends React.Component {
    state = {
        newComment: null,
    }

    render() {
        const {newComment} = this.state
        const {node} = this.props

        if (newComment != null) {
            return (
                <form onSubmit={(ev) => {
                    ev.preventDefault()
                    ev.stopPropagation()
                    api.newComment(newComment, node.id).then((response) => {
                        node.children.push(response.data)
                        this.setState({newComment: null})
                    })
                }}>
                    <textarea value={newComment} onInput={(ev) => {
                        this.setState({newComment: ev.target.value})
                    }} />
                    <input type="submit" value="Reply!" />
                    <div className="preview" dangerouslySetInnerHTML={{
                        __html: T.previewComment(newComment),
                    }} />
                </form>
            )
        } else {
            return (
                <a onClick={(ev) => {
                    ev.preventDefault()
                    ev.stopPropagation()
                    this.setState({newComment: ""})
                }}>
                    Reply!
                </a>
            )
        }
    }
}
