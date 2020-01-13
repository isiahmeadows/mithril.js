[*Up*](README.md)

# Transition API

This is exposed under `mithril/transition`.

> Note: move transitions are post-MVP due to complexity concerns that need addressed first.

- `transition(className)`, `transition(options)` - Track transitioning in and/or out and wait for all transitions to end before committing the change to the DOM.
    - `options.in` - The class or styles to set when the node is first created.
    - `options.out` - The class or styles to set when the node is removed.
    - `options.move` - The class or styles to set when the node is moved.
    - `className`, `options.class` - Sugar for `in: "foo-in"`, `out: "foo-out"`, and `move: "foo-move"`.
    - `options.afterIn()` - Optionally called after the transition in finishes.
    - `options.afterOut()` - Optionally called after the transition out finishes.
    - `options.afterMove()` - Optionally called after the move transition finishes.
    - Each option is a `[classOrStyle, transitionOpts]` tuple

`transition` works for both keyed and unkeyed lists as well. For keyed moves, it just uses [the FLIP principle](https://aerotwist.com/blog/flip-your-animations/), using `info.isParentMoving()` and `m.capture(callback)` to coordinate moves. (The "first" step is performed in the render callback if `info.isParentMoving()` and the rest during `ontransitionend`.) For additions, it's trivial with `info.isInitial()`, and for deletions, it uses `info.whenRemoved(callback)` and returns a promise.

It all might seem slightly magical, but it's far from it - it just returns a component that renders a handful of strategic attributes, [event handlers, and lifecycle methods](vnodes.md#attributes) and is otherwise entirely stateless.

### Why?

1. Transitions are common enough they should have a story, and a very simple one at that.
1. Add and remove transitions are not *hard* to get right, but they're not always *obvious*, and they can get slightly involved at times.
1. Move transitions are surprisingly *extremely* hard to get right, so hard that few frameworks even support them. Not even React's `react-transition-group` library supports them. Vue is among the few that does, and I've struggled to even replicate their implementation with vanilla DOM manipulation. Yes, it's actually that hard.
