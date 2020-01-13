import {m, component, slot} from "mithril"
import * as api from "../api.mjs"

export const NewThread = component(({onsave}) => {
    const [text, setText] = slot("")

    return m("form",
        m("textarea", {value: text, oninput: ["value", setText]}),
        m("input", {type: "submit", value: "Post!"}),
        {async onsubmit(ev, capture) {
            capture.event()
            const {data: thread} = await api.newThread(text)
            onsave(thread)
            setText("")
        }}
    )
})
