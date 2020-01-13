<template>
    <p>
        <router-link
            v-bind:to="'/thread/' + thread.id"
            v-html="trimTitle(thread.text)"
        ></router-link>
    </p>
    <p class="comment_count">{{thread.comment_count}} comment(s)</p>
    <hr>
</template>

<script>
export default {
    props: ["thread"],

    methods: {
        trimTitle: (text) => T.trimTitle(text),
    },
}
</script>
