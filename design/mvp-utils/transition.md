[*Up*](README.md)

# Transition API

This is exposed under `mithril/transition`.

- `transition(className)`, `transition(options)` - Track transitioning in and/or out and wait for all transitions to end before committing the change to the DOM.
    - `options.in` - The class to assign for when the node is first added.
    - `options.out` - The class to assign for when the node is first removed.
    - `options.move` - The class to assign for when you move.
    - `className`, `options.class` - Sugar for `in: "foo-in"`, `out: "foo-out"`, and `move: "foo-move"`.
    - `options.afterIn()` - Optionally called after the transition in finishes.
    - `options.afterOut()` - Optionally called after the transition out finishes.
    - `options.afterMove()` - Optionally called after the move transition finishes.
    - When an element is hidden and immediately re-shown, the removal animation is awaited and the element fully removed before it's re-added.
    - When an element is removed and immediately re-added and removed again, the removal animation is *not* restarted, nor is it re-added.

`transition` works for both keyed and unkeyed lists as well. For keyed moves, it just uses [the FLIP principle](https://aerotwist.com/blog/flip-your-animations/), using `duringCommit` and `afterCommit` to coordinate moves. (The "first" step is performed in `duringCommit` and the rest during `afterCommit`.) For additions, it's trivial with `afterCommit`, and for deletions, it uses `blockRemoval`.

It all might seem slightly magical, but it doesn't even need context - it just returns an inline vnode that returns a handful of strategic attributes and is otherwise entirely stateless.

### Why?

1. Transitions are common enough they should have a story, and a very simple one at that.
1. Transitions are not *hard* to get right, but they're not *obvious*, either and they do get slightly involved at times.
