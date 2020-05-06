import {m} from "mithril"
import * as api from "../api.mjs"

export default function NewThread({on}, info) {
    const text = info.init(() => "")

    return m("form",
        m("textarea", {value: text, on: {input: ["value", (t) => info.state = t]}}),
        m("input", {type: "submit", value: "Post!"}),
        {on: {async submit(ev, capture) {
            capture.event()
            const {data: thread} = await api.newThread(info.state)
            on.save(thread)
            info.state = ""
        }}}
    )
}
