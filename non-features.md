[*Up*](./README.md)

# Non-features

This is a list of things that just aren't going to happen. I've already looked into them, considered them, and have even toyed with them some, but they just don't fit, and there's better, simpler ways to handle the problems they were meant to solve.

## Hooks

Read [here](rationale.md#hooks) for an explanation of why. TL;DR: they're a step in the right direction, but they still don't solve the problem of effect composition as effectively as they think they do, and there's also a fair bit of unnecessary verbosity and magic in the mix.

## Async loading

I initially considered adding an [async loading utility](excluded/async.mjs), but it ended up being simpler to just do it all manually when redraws are exclusively component-initiated. Also, it's not like that utility is as trivial to write as it would seem at first glance, and if cancellation is unnecessary.

```js
// ES6
// 12 lines: just using `Mithril.abortable` from `mithril/dom`
const vnode = Mithril.abortable((signal, render) => {
	render(m("h2", "Loading"))
	api.thread(id, {signal}).then(({root: node}) => {
		document.title =
			`ThreaditJS: Mithril | ${T.trimTitle(node.text)}`
		render(m(ThreadNode, {node}))
	}, (e) => {
		render(e.status === 404
			? m("h2", "Not found! Don't try refreshing!")
			: m("h2", "Error! Try refreshing."))
	})
})

// 12 lines: using that `Async` component referenced above
const vnode = m(Async, {
	init: () => api.thread(id).then(({root: node}) => {
		document.title =
			`ThreaditJS: Mithril | ${T.trimTitle(node.text)}`
		return node
	}),
	loading: () => m("h2", "Loading"),
	error: (e) => e.status === 404
		? m("h2", "Not found! Don't try refreshing!")
		: m("h2", "Error! Try refreshing."),
	ready: (node) => m(ThreadNode, {node}),
})

// ES5
// 12 lines: just using `Mithril.abortable` from `mithril/dom`
var vnode = Mithril.abortable(function (signal, render) {
	render(m("h2", "Loading"))
	api.thread(id, {signal: signal}).then(function (response) {
		document.title =
			`ThreaditJS: Mithril | ${T.trimTitle(response.root.text)}`
		render(m(ThreadNode, {node: response.root}))
	}, function (e) {
		render(e.status === 404
			? m("h2", "Not found! Don't try refreshing!")
			: m("h2", "Error! Try refreshing."))
	})
})

// 20 lines: using that `Async` component referenced above
var vnode = m(Async, {
	init: function () {
		return api.thread(id).then(function (response) {
			document.title =
				`ThreaditJS: Mithril | ${T.trimTitle(response.root.text)}`
			return response.root
		})
	},
	loading: function () {
		return m("h2", "Loading")
	},
	error: function (e) {
		return e.status === 404
			? m("h2", "Not found! Don't try refreshing!")
			: m("h2", "Error! Try refreshing.")
	},
	ready: function (node) {
		return m(ThreadNode, {node})
	},
})
```
