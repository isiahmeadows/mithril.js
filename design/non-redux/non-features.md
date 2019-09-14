[*Up*](./README.md)

# Non-features

This is a list of things that just aren't going to happen. I've already looked into them, considered them, and have even toyed with them some, but they just don't fit, and there's better, simpler ways to handle the problems they were meant to solve.

## Hooks

Read [here](rationale.md#hooks) for an explanation of why. TL;DR: they're a step in the right direction, but they still don't solve the problem of effect composition as effectively as they think they do, and there's also a fair bit of unnecessary verbosity and magic in the mix.

## Async loading

I initially considered adding an [async loading utility](excluded/async.mjs), but it ended up being simpler to just do it all manually when redraws are exclusively component-initiated. Also, it's not like that utility is as trivial to write as it would seem at first glance, especially if cancellation comes into the picture. Instead, I provided a smaller, more general utility called [`Mithril.abortable`](core/dom.md), exported from `mithril/dom`, and that makes it much easier to be explicit about when things happen, without the cost of conciseness.

```js
// ES6
// 11 lines: just using `Mithril.abortable` from `mithril/dom`
const vnode = Mithril.abortable((signal, o) => {
    o.next(m("h2", "Loading"))
    api.thread(id, {signal}).then(({root: node}) => {
        document.title = `ThreaditJS: Mithril | ${T.trimTitle(node.text)}`
        o.next(m(ThreadNode, {node}))
    }, (e) => {
        o.next(e.status === 404
            ? m("h2", "Not found! Don't try refreshing!")
            : m("h2", "Error! Try refreshing."))
    })
})

// 11 lines: using that `Async` component referenced above
const vnode = m(Async, {
    init: () => api.thread(id).then(({root: node}) => {
        document.title = `ThreaditJS: Mithril | ${T.trimTitle(node.text)}`
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
var vnode = Mithril.abortable(function (signal, o) {
    o.next(m("h2", "Loading"))
    api.thread(id, {signal: signal}).then(function (response) {
        document.title =
            "ThreaditJS: Mithril | " + T.trimTitle(response.root.text)
        o.next(m(ThreadNode, {node: response.root}))
    }, function (e) {
        o.next(e.status === 404
            ? m("h2", "Not found! Don't try refreshing!")
            : m("h2", "Error! Try refreshing."))
    })
})

// 20 lines: using that `Async` component referenced above
var vnode = m(Async, {
    init: function () {
        return api.thread(id).then(function (response) {
            document.title =
                "ThreaditJS: Mithril | " + T.trimTitle(response.root.text)
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

// 16 lines: trying to compress the above snippet at the cost of some
// readability
var vnode = m(Async, {
    init: function () {
        return api.thread(id).then(function (response) {
            document.title =
                "ThreaditJS: Mithril | " + T.trimTitle(response.root.text)
            return response.root
        })
    },
    loading: function () { return m("h2", "Loading") },
    error: function (e) {
        return e.status === 404
            ? m("h2", "Not found! Don't try refreshing!")
            : m("h2", "Error! Try refreshing.")
    },
    ready: function (node) { return m(ThreadNode, {node}) },
})
```

## Ref combinators

They sound nice in theory, for similar reasons `m.prop` sounds nice in theory. It sounds like it'd reduce boilerplate very nicely with its ability to magically compose things, but in practice, it adds literally nothing [for the complexity it brings](excluded/refs.mjs). For a concrete example, compare these two variants:

- No ref combinators:

    ```js
    let minActive, maxActive, bias
    return m("form", [
        m("input[type=number][value=0]", {afterCommit(e) { minActive = e }}),
        m("input[type=number][value=100]", {afterCommit(e) { maxActive = e }}),
        m("input[type=range][value=50]", {afterCommit(e) { bias = e }}),
        {onsubmit(ev, capture) {
            capture()
            request("/api/example", {method: "POST", body: {
                minActive: minActive.value,
                maxActive: maxActive.value,
                bias: bias.value,
            }})
        }},
    ])
    ```

- With ref combinators:

    ```js
    let current
    const refs = Ref.join((elems) => current = elems)
    return m("form", [
        m("input[type=number][value=0]", {afterCommit: refs("minActive")}),
        m("input[type=number][value=100]", {afterCommit: refs("maxActive")}),
        m("input[type=range][value=50]", {afterCommit: refs("bias")}),
        {onsubmit(ev, capture) {
            capture()
            request("/api/example", {method: "POST", body: {
                minActive: minActive.value,
                maxActive: maxActive.value,
                bias: bias.value,
            }})
        }},
    ])
    ```

For the one area where it would seem to help the most, it really doesn't. Also, it isn't type-safe and leaves it hard to lint, especially when dynamic keys get involved. (It really isn't worth it.)

## Raw element support

A previous iteration of this proposal contained raw element vnodes, sufficient to move trusted vnodes to userland. This sounds great and all until you get to thinking about how it might serialize. (It doesn't, and you'd find yourself writing a lot of explicit code to shoehorn it.) In addition, it complicates diffing, because the check for whether two vnodes are equal now go beyond simple vnode type + tag + key + possible `is` checking, something that [can in fact be reduced to a purely numeric check post-normalization](vnode-structure.md#check-if-a-subtree-should-be-patched-or-replaced). Changing this invariant increases the number of branches in an admittedly *very* complex part of the code base, so it's best to not add more to the problem.

It also carries the issue of how to handle the differences between a renderer that renders strings, a renderer that renders to a DOM vnode tree, and a renderer that renders against a real persistent DOM. So given there's no clear one way to model this, I decided to drop it altogether. (A third-party renderer is free to support that primitive, but none of the core ones will.)
