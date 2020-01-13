<script>
import * as api from "../api.mjs"
export let node

let replying = false
let comment = ""

$: preview = T.previewComment(comment)

async function submit() {
    const {data} = await api.newComment(comment, node.id)
    node.children.push(data)
    replying = false
    comment = ""
}
</script>

{#if replying}
    <form on:submit|preventDefault|stopPropagation={submit}>
        <textarea bind:value={comment}></textarea>
        <input type="submit" value="Reply!">
        <div class="preview">{@html preview}</div>
    </form>
{:else}
    <a on:click|preventDefault|stopPropagation={replying = true}>Reply!</a>
{/if}
