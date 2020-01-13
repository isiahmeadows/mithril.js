import React, {useState} from "react"
import api from "../api.js"

export default function NewThread({onSave}) {
    const [value, setValue] = useState("")

    return (
        <form onSubmit={(ev) => {
            ev.preventDefault()
            ev.stopPropagation()
            api.newThread(value).then(({data: thread}) => {
                if (onSave) onSave(thread)
                setValue("")
            })
        }}>
            <textarea
                value={value}
                onInput={(ev) => setValue(ev.target.value)}
            />
            <input type="submit" value="Post!" />
        </form>
    )
}
