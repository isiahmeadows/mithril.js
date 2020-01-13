import m from "mithril"
import * as api from "../api.mjs"

export default function NewThread() {
    let value

    return {
        view: ({attrs}) => m("form", {onsubmit() {
            api.newThread(value)
                .then(({data: thread}) => {
                    value = ""
                    if (attrs.onSave) attrs.onSave(thread)
                })
                .finally(m.redraw)
            return false
        }}, [
            m("textarea", {value, oninput: (ev) => value = ev.target.value}),
            m("input[type=submit][value='Post!']"),
        ]),
    }
}
