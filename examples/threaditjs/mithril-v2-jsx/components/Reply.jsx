import m from "mithril"
import * as api from "../api.mjs"

export default function Reply() {
    let newComment

    return {
        view: ({attrs: {node}}) => {
            if (newComment != null) {
                return (
                    <form onsubmit={() => {
                        api.newComment(newComment, node.id).then((response) => {
                            node.children.push(response.data)
                            newComment = null
                        })
                        return false
                    }}>
                        <textarea
                            value={newComment}
                            oninput={(ev) => newComment = ev.target.value}
                        />
                        <input type="submit" value="Reply!" />
                        <div class="preview">
                            {m.trust(T.previewComment(newComment))}
                        </div>
                    </form>
                )
            } else {
                return (
                    <a onclick={() => newComment = ""}>Reply!</a>
                )
            }
        },
    }
}
