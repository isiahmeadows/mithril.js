<script>
import {Navigate} from "svelte-router-spa"

export let thread

$: title = T.trimTitle(thread.text)
</script>

<p><Navigate to="/thread/{thread.id}">{@html title}</Navigate></p>
<p class="comment_count">{{thread.comment_count}} comment(s)</p>
<hr>
