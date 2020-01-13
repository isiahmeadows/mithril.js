import React from "react"
import api from "../api.js"

export default class NewThread extends React.Component {
    state = {
        value: "",
    }

    render() {
        const {value} = this.state
        const {onSave} = this.props

        return (
            <form onSubmit={(ev) => {
                ev.preventDefault()
                ev.stopPropagation()
                api.newThread(value).then(({data: thread}) => {
                    if (onSave) onSave(thread)
                    this.setState({value: ""})
                })
            }}>
                <textarea value={value} onInput={(ev) => {
                    this.setState({value: ev.target.value})
                }} />
                <input type="submit" value="Post!" />
            </form>
        )
    }
}
