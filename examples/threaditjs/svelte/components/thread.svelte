<script>
import Layout from "./layout.svelte"
import ThreadNode from "./thread-node.svelte"
import * as api from "../api.mjs"

export let currentRoute
let root

$: title = T.trimTitle(root.text)

async function load(signal) {
    root = (await api.thread(currentRoute.namedParams.id, {signal})).root
}
</script>

<svelte:head>
    <title>ThreaditJS: Svelte | {title}</title>
</svelte:head>

<Layout {load}>
    <ThreadNode node={root} />
</Layout>
