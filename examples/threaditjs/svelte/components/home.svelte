<script>
import Layout from "./layout.svelte"
import * as api from "../api.mjs"

let threads = []

async function load(signal) {
    threads = (await api.home({signal})).data
}
</script>

<svelte:head>
    <title>ThreaditJS: Svelte | Home</title>
</svelte:head>

<Layout {load}>
    {#each threads as thread (thread.id)}
        <ThreadPreview {thread} />
    {/each}
    <NewThread on:save={() => threads = [...threads, thread]} />
</Layout>
