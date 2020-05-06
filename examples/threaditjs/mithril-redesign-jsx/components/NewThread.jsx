import {m} from "mithril"
import * as api from "../api.mjs"

export default function NewThread({on}, info) {
    const text = info.init(() => "")

    async function saveThread(ev, capture) {
        capture.event()
        const {data: thread} = await api.newThread(info.state)
        on.save(thread)
        info.state = ""
    }

    return <form on={{submit: saveThread}}>
        <textarea value={text} on={{input: ["value", (t) => info.state = t]}} />
        <input type="submit" value="Post!" />
    </form>
}
