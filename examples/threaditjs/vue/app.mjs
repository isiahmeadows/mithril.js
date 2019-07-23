/* global Vue, VueRouter */

// API calls
T.time("Setup")

const requestJson = (opts, method = "GET") => async (strs, ...args) => {
	const url = T.apiUrl +
		args.map(encodeURIComponent).map((x, i) => strs[i] + x).join("") +
		strs[strs.length - 1]
	const response = await fetch(url, {...opts, method})
	if (response.ok) return response.json()
	const err = new Error(`${response.status} ${response.statusText}`)
	err.code = response.status
	throw err
}

const api = {
	async home(opts) {
		T.timeEnd("Setup")
		return requestJson(opts)`/threads`
	},
	async thread(id, opts) {
		T.timeEnd("Setup")
		return T.transformResponse(await requestJson(opts)`/threads/${id}`)
	},
	async newThread(text, opts) {
		return requestJson(opts, "POST")`/threads/create?text=${text}`
	},
	async newComment(text, id, opts) {
		return requestJson(opts, "POST")`/comments/create?text=${text}&parent=${id}`
	},
}

// shared
Vue.component("app-layout", {
	template: `
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
    `,

	props: ["load"],

	data() {
		return {
			state: "loading",
			controller: new AbortController(),
		}
	},

	created() {
		this.load(this.controller.signal).then((response) => {
			document.title = "ThreaditJS: React | Home"
			this.state = "ready"
			this.$emit("load", response)
		}, (e) => {
			this.state = e.status === 404 ? "notFound" : "error"
		})
	},
})

// home
Vue.component("thread-preview", {
	template: `
		<p>
			<router-link
				v-bind:to="'/thread/' + thread.id"
				v-html="trimTitle(thread.text)"
			></router-link>
		</p>
		<p class="comment_count">{{thread.comment_count}} comment(s)</p>
		<hr>
	`,

	props: ["thread"],

	methods: {
		trimTitle: (text) => T.trimTitle(text),
	}
})

Vue.component("new-thread", {
	template: `
		<form v-bind:submit.prevent.stop="submit">
			<textarea v-model="comment"></textarea>
			<input type="submit" value="Post!">
		</form>
	`,

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
})

const Home = {
	template: `
        <app-layout v-bind:load="load" v-on:load="initialize">
			<thread-preview
				v-for="thread in threads"
				v-bind:key="thread.id"
				v-bind:thread="thread"
			></thread-preview>
			<new-thread v-on:save="save"></new-thread>
		</app-layout>
    `,

	data() {
		return {threads: []}
	},

	methods: {
		load(signal) {
			return api.home({signal})
		},

		initialize(response) {
			document.title = "ThreaditJS: Mithril | Home"
			this.threads = response.data
		},

		save(thread) {
			this.threads.push(thread)
		},
	},
}

// thread
Vue.component("thread-node", {
	template: `
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
	`,

	props: ["node"],
})

Vue.component("thread-reply", {
	template: `
		<form v-if="replying" v-on:submit.prevent.stop="submit">
			<textarea v-model="comment"></textarea>
			<input type="submit" value="Reply!">
			<div class="preview" v-html="preview"></div>
		</form>
		<a v-else v-on:click.prevent.stop="replying = true">Reply!</a>
	`,

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
		}
	}
})

const Thread = {
	template: `
        <app-layout v-bind:load="load" v-on:load="initialize">
			<thread-node v-bind:node="root"></thread-node>
		</app-layout>
    `,

	data() {
		return {root: undefined}
	},

	methods: {
		load(signal) {
			return api.thread(this.$route.params.id, {signal})
		},

		initialize(response) {
			const title = T.trimTitle(response.root.text)
			document.title = `ThreaditJS: Mithril | ${title}`
			this.root = response.root
		},
	},
}

// router
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
