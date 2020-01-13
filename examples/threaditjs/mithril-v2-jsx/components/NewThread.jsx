import m from "mithril"
import * as api from "../api.mjs"

export default function NewThread() {
    let value

    return {
        view: ({attrs}) => (
            <form onsubmit={() => {
                api.newThread(value)
                    .then(({data: thread}) => {
                        value = ""
                        if (attrs.onSave) attrs.onSave(thread)
                    })
                    .finally(m.redraw)
                return false
            }}>
                <textarea value={value} oninput={(ev) => value = ev.target.value} />
                <input type="submit" value="Post!" />
            </form>
        ),
    }
}
