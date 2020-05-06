import {m} from "mithril"
import * as api from "../api.mjs"

export default function Reply({node}, info) {
    const state = info.init(() => ({comment: null, preview: null}))

    function setComment(value) {
        if (value === state.comment) return
        state.comment = value
        state.preview = T.previewComment(state.comment || "")
    }

    return ({node}) => m.if(state.comment != null, {
        then: () => (
            <form onsubmit={async (ev, capture) => {
                capture.event()
                const {data} = await api.newComment(state.comment, node.id)
                node.children.push(data)
                setComment(null)
            }}>
                <textarea value={state.comment} oninput={["value", setComment]} />
                <input type="submit" value="Reply!" />
                <div class="preview" innerHTML={state.preview} />
            </form>
        ),
        else: () => (
            <a onclick={() => setComment("")}>Reply!</a>
        ),
    })
}
