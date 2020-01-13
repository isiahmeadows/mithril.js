import {m, component, slot} from "mithril"
import * as api from "../api.mjs"

export const NewThread = component(({onsave}) => {
    const [text, setText] = slot("")

    async function saveThread(ev, capture) {
        capture.event()
        const {data: thread} = await api.newThread(text)
        onsave(thread)
        setText("")
    }

    return <form onsubmit={saveThread}>
        <textarea value={text} oninput={["value", setText]} />
        <input type="submit" value="Post!" />
    </form>
})
