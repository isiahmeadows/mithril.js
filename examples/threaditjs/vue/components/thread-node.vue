<template>
    <div class="comment">
        <p v-html="node.text"></p>
        <div class="reply"><thread-reply :node="node"></thread-reply></div>
        <div class="children">
            <thread-node
                v-for="child in node.children"
                v-bind:key="child.id"
                v-bind:node="child"
            ></thread-node>
        </div>
    </div>
</template>

<script>
import ThreadReply from "./thread-reply.vue"

export default {
    name: "thread-node",

    props: ["node"],

    components: {
        ThreadReply,
    },
}
</script>
