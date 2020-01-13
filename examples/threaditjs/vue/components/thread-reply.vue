<template>
    <form v-if="replying" v-on:submit.prevent.stop="submit">
        <textarea v-model="comment"></textarea>
        <input type="submit" value="Reply!">
        <div class="preview" v-html="preview"></div>
    </form>
    <a v-else v-on:click.prevent.stop="replying = true">Reply!</a>
</template>

<script>
import * as api from "../api.mjs"

export default {
    props: ["node"],

    data() {
        return {
            replying: false,
            comment: "",
        }
    },

    computed: {
        preview() { return T.previewComment(this.comment) },
    },

    methods: {
        async submit() {
            const {data} = await api.newComment(this.comment, this.node.id)
            this.node.children.push(data)
            this.replying = false
            this.comment = ""
        },
    },
}
</script>
