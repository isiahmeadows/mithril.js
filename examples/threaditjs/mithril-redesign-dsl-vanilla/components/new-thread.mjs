import {m, component, slot} from "mithril"
import * as api from "../api.mjs"

export const NewThread = component(({on}) => {
    const [text, setText] = slot("")

    return m("form",
        {on: {async submit(ev, capture) {
            capture.event()
            const {data: thread} = await api.newThread(text)
            on.save(thread)
            setText("")
        }}},
        m("textarea", {value: text, on: {input: ["value", setText]}}),
        m("input", {type: "submit", value: "Post!"})
    )
})
