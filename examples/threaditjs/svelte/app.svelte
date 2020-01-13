<script>
import {Router} from "svelte-router-spa"
import Home from "./components/home.svelte"
import Thread from "./components/thread.svelte"

const routes = [
    {name: "/", component: Home},
    {name: "/thread/:id", component: Thread},
]
</script>

<Router {routes} />
