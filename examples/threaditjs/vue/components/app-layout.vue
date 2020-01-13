<template>
    <p class="head_links">
        <a href="https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/vue">Source</a> |
        <a href="https://threaditjs.com">ThreaditJS: Home</a>
    </p>
    <h2>
        <router-link to="/">ThreaditJS: Vue</router-link>
    </h2>
    <div class="main">
        <h2 v-if="state === 'loading'">Loading</h2>
        <h2 v-else-if="state === 'notFound'">Not found! Don't try refreshing!</h2>
        <h2 v-else-if="state === 'error'">Error! Try refreshing.</h2>
        <slot v-else></slot>
    </div>
</template>

<script>
export default {
    props: ["load"],

    data() {
        return {
            state: "loading",
            controller: new AbortController(),
        }
    },

    created() {
        this.load(this.controller.signal).then(
            () => this.state = "ready",
            (e) => this.state = e.status === 404 ? "notFound" : "error"
        )
    },

    destroyed() {
        this.controller.abort()
    },
}
</script>
