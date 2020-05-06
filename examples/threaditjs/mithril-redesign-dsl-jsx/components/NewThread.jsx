import {m, component, slot} from "mithril"
import * as api from "../api.mjs"

export const NewThread = component(({on}) => {
    const [text, setText] = slot("")

    async function saveThread(ev, capture) {
        capture.event()
        const {data: thread} = await api.newThread(text)
        on.save(thread)
        setText("")
    }

    return <form onsubmit={saveThread}>
        <textarea value={text} oninput={["value", setText]} />
        <input type="submit" value="Post!" />
    </form>
})
