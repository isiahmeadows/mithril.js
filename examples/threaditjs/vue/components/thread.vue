<template>
    <app-layout v-bind:load="load">
        <thread-node v-bind:node="root"></thread-node>
    </app-layout>
</template>

<script>
import AppLayout from "./app-layout.vue"
import ThreadNode from "./thread-node.vue"
import * as api from "../api.mjs"

export default {
    data() {
        return {root: undefined}
    },

    methods: {
        load(signal) {
            return api.thread(this.$route.params.id, {signal}).then(() => {
                const title = T.trimTitle(response.root.text)
                document.title = `ThreaditJS: Vue | ${title}`
                this.root = response.root
            })
        },
    },

    components: {
        AppLayout,
        ThreadNode,
    },
}
</script>
