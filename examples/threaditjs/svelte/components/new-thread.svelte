<script>
import * as api from "../api.mjs"
import {createEventDispatcher} from "svelte"

const dispatch = createEventDispatcher()
let comment = ""

async function submit() {
    const {data: thread} = await api.newThread(comment)
    comment = ""
    dispatch("save", thread)
}
</script>

<form on:submit|preventDefault|stopPropagation="submit">
    <textarea bind:value={comment}></textarea>
    <input type="submit" value="Post!">
</form>
