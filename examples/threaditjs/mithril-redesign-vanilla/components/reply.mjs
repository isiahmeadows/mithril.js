import {m} from "mithril"
import * as api from "../api.mjs"

export default function Reply({node}, info) {
    const state = info.init(() => ({comment: null, preview: null}))

    function setComment(value) {
        if (value === state.comment) return
        state.comment = value
        state.preview = T.previewComment(state.comment || "")
    }

    return m.if(state.comment != null, {
        then: () => m("form",
            {on: {async submit(_, capture) {
                capture.event()
                const {data} = await api.newComment(state.comment, node.id)
                node.children.push(data)
                setComment(null)
            }}},
            m("textarea", {value: state.comment, on: {input: ["value", setComment]}}),
            m("input", {type: "submit", value: "Reply!"}),
            m("div.preview", {innerHTML: state.preview})
        ),
        else: () => m("a", {on: {click() { setComment("") }}}, "Reply!")
    })
}
