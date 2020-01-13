import Vue from "vue"
import VueRouter from "vue-router"
import Home from "./components/home.vue"
import Thread from "./components/thread.vue"

T.time("Setup")

const router = new VueRouter({
    routes: [
        {path: "/", component: Home},
        {path: "/thread/:id", component: Thread},
    ]
})

new Vue({
    template: "<router-view></router-view>",
    router,
}).$mount("#app")
