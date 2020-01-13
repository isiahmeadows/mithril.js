import {m} from "mithril"
import * as api from "../api.mjs"

export default function NewThread({onsave}, info) {
    if (info.state == null) info.state = ""

    return m("form",
        m("textarea", {value: info.state, oninput: ["value", (t) => info.state = t]}),
        m("input", {type: "submit", value: "Post!"}),
        {async onsubmit(ev, capture) {
            capture.event()
            const {data: thread} = await api.newThread(info.state)
            onsave(thread)
            info.state = ""
        }}
    )
}
