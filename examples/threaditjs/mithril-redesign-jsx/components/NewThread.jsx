import {m} from "mithril"
import * as api from "../api.mjs"

export default function NewThread({onsave}, info) {
    if (!info.state) info.state = ""

    async function saveThread(ev, capture) {
        capture.event()
        const {data: thread} = await api.newThread(info.state)
        onsave(thread)
        info.state = ""
    }

    return <form onsubmit={saveThread}>
        <textarea value={info.state} oninput={["value", (t) => info.state = t]} />
        <input type="submit" value="Post!" />
    </form>
}
