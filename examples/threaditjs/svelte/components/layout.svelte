<script>
import {Navigate} from "svelte-router-spa"
import {onMount} from "svelte"

export let load
let state = "loading"
let value

onMount(() => {
    const controller = new AbortController()
    load(controller.signal).then(
        (v) => { state = "ready"; value = v },
        (e) => { state = e.status === 404 ? "notFound" : "error" }
    )
    return () => controller.abort()
})
</script>

<p class="head_links">
    <a href="https://github.com/isiahmeadows/mithril.js/tree/redesign-redux/examples/threaditjs/svelte">Source</a> |
    <a href="https://threaditjs.com">ThreaditJS: Home</a>
</p>
<h2>
    <Navigate to="/">ThreaditJS: Svelte</Navigate>
</h2>
<div class="main">
    {#if state === "loading"}
        <h2>Loading</h2>
    {:else if state === "notFound"}
        <h2>Not found! Don't try refreshing!</h2>
    {:else if state === "error"}
        <h2>Error! Try refreshing.</h2>
    {:else}
        <slot></slot>
    {/if}
</div>
