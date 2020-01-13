import {m, component, slot, memo, guard, when, hasChanged} from "mithril"
import * as api from "../api.mjs"

export const Reply = component(({node}) => {
    const [comment, setComment] = slot()
    const preview = memo(comment || "", T.previewComment)

    return when(comment != null, {
        then: () => (
            <form onsubmit={async (ev, capture) => {
                capture.event()
                const {data} = await api.newComment(comment, node.id)
                node.children.push(data)
                setComment(null)
            }}>
                <textarea value={comment} oninput={["value", setComment]} />
                <input type="submit" value="Reply!" />
                <div class="preview" innerHTML={preview} />
            </form>
        ),
        else: () => (
            <a onclick={() => setComment("")}>Reply!</a>
        ),
    })
})
