<template>
    <app-layout v-bind:load="load">
        <thread-preview
            v-for="thread in threads"
            v-bind:key="thread.id"
            v-bind:thread="thread"
        ></thread-preview>
        <new-thread v-on:save="save"></new-thread>
    </app-layout>
</template>

<script>
import AppLayout from "./app-layout.vue"
import ThreadPreview from "./thread-preview.vue"
import * as api from "../api.mjs"

export default {
    data() {
        return {threads: []}
    },

    methods: {
        load(signal) {
            return api.home({signal}).then((response) => {
                document.title = "ThreaditJS: Vue | Home"
                this.threads = response.data
            })
        },

        save(thread) {
            this.threads.push(thread)
        },
    },

    components: {
        AppLayout,
        ThreadPreview,
    },
}
</script>
