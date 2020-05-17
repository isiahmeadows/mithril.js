import {m, component, slot, memo} from "mithril"
import * as api from "../api.mjs"

export default component("Reply", ({node}) => {
    const [comment, setComment] = slot()
    const preview = memo(comment || "", T.previewComment)

    return m.if(comment != null, {
        then: () => m("form",
            {on: {async submit(_, capture) {
                capture.event()
                const {data} = await api.newComment(comment, node.id)
                node.children.push(data)
                setComment(null)
            }}},
            m("textarea", {value: comment, on: {input: ["value", setComment]}}),
            m("input", {type: "submit", value: "Reply!"}),
            m("div.preview", {innerHTML: preview})
        ),
        else: () => m("a", {on: {click() { setComment("") }}}, "Reply!")
    })
})
