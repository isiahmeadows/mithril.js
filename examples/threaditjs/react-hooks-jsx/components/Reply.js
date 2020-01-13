import React, {useState} from "react"
import api from "../api.js"

export default function Reply({node}) {
    const [newComment, setNewComment] = useState()

    if (newComment != null) {
        return (
            <form onSubmit={(ev) => {
                ev.preventDefault()
                ev.stopPropagation()
                api.newComment(newComment, node.id).then((response) => {
                    node.children.push(response.data)
                    setNewComment()
                })
            }}>
                <textarea
                    value={newComment}
                    onInput={(ev) => setNewComment(ev.target.value)}
                />
                <input type="submit" value="Reply!" />
                <div
                    className="preview"
                    dangerouslySetInnerHTML={{
                        __html: T.previewComment(newComment),
                    }}
                />
            </form>
        )
    } else {
        return (
            <a onClick={(ev) => {
                ev.preventDefault()
                ev.stopPropagation()
                setNewComment("")
            }}>
                Reply!
            </a>
        )
    }
}
