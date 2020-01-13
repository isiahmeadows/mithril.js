<template>
    <form v-bind:submit.prevent.stop="submit">
        <textarea v-model="comment"></textarea>
        <input type="submit" value="Post!">
    </form>
</template>

<script>
import * as api from "../api.mjs"

export default {
    data() {
        return {comment: ""}
    },

    methods: {
        async submit() {
            const {data: thread} = await api.newThread(this.comment)
            this.comment = ""
            this.$emit("save", thread)
        },
    }
}
</script>
