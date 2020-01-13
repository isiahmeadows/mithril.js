<script>
import Reply from "./reply.svelte"
export let node
</script>

<div class="comment">
    <p>{@html node.text}</p>
    <div class="reply"><Reply {node} /></div>
    <div class="children">
        {#each node.children as child (child.id)}
            <svelte:self node={child} />
        {/each}
    </div>
</div>
