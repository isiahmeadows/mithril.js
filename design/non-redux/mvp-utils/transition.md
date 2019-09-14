[*Up*](README.md)

# Transition API

This is exposed under `mithril/transition`.

- `transition(className)`, `transition(options)` - Track transitioning in and/or out and wait for all transitions to end before committing the change to the DOM.
    - `options.in` - The class or styles to set when the node is first added.
    - `options.out` - The class or styles to set when the node is first removed.
    - `options.move` - The class or styles to set when the node is moved.
    - `className`, `options.class` - Sugar for `in: "foo-in"`, `out: "foo-out"`, and `move: "foo-move"`.
    - `options.afterIn()` - Optionally called after the transition in finishes.
    - `options.afterOut()` - Optionally called after the transition out finishes.
    - `options.afterMove()` - Optionally called after the move transition finishes.
    - TODO: figure out what semantics to have when moving during the in transition in and removing during the in or move transitions.

`transition` works for both keyed and unkeyed lists as well. For keyed moves, it just uses [the FLIP principle](https://aerotwist.com/blog/flip-your-animations/), using `beforeCommit` and `afterCommit` to coordinate moves. (The "first" step is performed in `beforeCommit` and the rest during `afterCommit`.) For additions, it's trivial with `afterCommit`, and for deletions, it uses `blockRemoval`.

It all might seem slightly magical, but it doesn't even need context - it just returns an [inline vnode](../core/hyperscript.md#vnode-types) that returns a handful of strategic attributes, [event handlers, and lifecycle methods](../core/events.md) and is otherwise entirely stateless.

### Why?

1. Transitions are common enough they should have a story, and a very simple one at that.
1. Transitions are not *hard* to get right, but they're not *obvious*, either and they do get slightly involved at times.
