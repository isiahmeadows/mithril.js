[*Up*](README.md)

# Components

- Components: `component(attrs, emit): view`
	- `attrs` is a stream that emits each received attributes object.
		- On subscription, this invokes the observer's `.next` method.
		- On attribute update, this invokes all subscribed observers' `.next` methods.
		- On subtree removal, this invokes all subscribed observers' `.return` methods.
		- Invoking the returned `done` callback simply removes the subscription.
		- All observer methods are optional.
	- `emit` is as documented [here](vnodes.md#events).
	- `view` is simply a vnode. Conveniently, this *does* include streams itself.
- Components simply map attributes to a view. Mithril doesn't care about the attribute values themselves.
- Intentionally, components do have a friendly API that works even if you choose to use it not as a component.
- If you want to actually update the view, use a dynamic vnode
- Refs on components pass through to the component's body.
- If you want to remember attributes, store them in the state.
- If you want to remember old attributes or state, store them in the new state.
- Note: incoming vnode children are accessible via `attrsValue.children`.
- Note: the attributes stream supports multiple observers. So you can do things like have multiple `Stream.map(attrs, ...)` in your view, without issue.

### Why separate the updating from components?

There's a few reasons:

1. Instead of component attributes being stored on the internal model, it's stored in a closure (the lazy or dynamic vnode's body) that implicitly gets replaced on update. In many cases, this provides a substantial memory win, since in practice, attributes are often not necessary.
2. This *only* updates when the attributes have to update. This cuts down *tremendously* on redraw times, so auto-redraws are never global.
2. Updating can happen anywhere, and it doesn't matter where it is as long as the tree is updated appropriately. This brings a lot of added flexbility.
3. Components now only serve one master: abstraction. Dynamic vnodes serve the single master of enabling subtree updates.

### Data flow model

If you've ever used [React Redux](https://react-redux.js.org/) or [Cycle.js](https://cycle.js.org) and you squint hard enough, you can see a mild resemblance [to](https://redux.js.org/basics/usage-with-react) [both](https://cycle.js.org/#-example). Yes, both of these are partial inspirations, but this is also partially just a superficial coincidence:

- Cycle.js joins streams, but it views components as more of a function of input sources to output sources. It draws a much greater inspiration from [the Model-View-Intent architecture](http://hannesdorfmann.com/android/mosby3-mvi-3), where the intents are derived from DOM events, the model receives intents and emits view states, and the view takes view states and returns a DOM.
- [Redux](https://redux.js.org/introduction/three-principles) is built on states, and together with something like React Redux, it inadvertently also implements a variant of the MVI architecture. You dispatch actions that act as "intents", reducers and stores work together as a conceptual "model", and the (usually React) component they plug into functions as the "view". Redux reducers also sometimes short-circuit the MVI loop by producing actions of their own through [Redux Thunk](https://github.com/reduxjs/redux-thunk), but this is uncommon and usually only exists for internal model updates.
	- I'm [not the](https://medium.com/@chessmani/yup-by-the-way-mvi-is-really-no-different-from-redux-its-just-a-different-name-which-i-wish-a3f3fe334fd9) [only one](https://github.com/mboudraa/flow/tree/eaf4973e798ea55f9b7eb07a37d4d9a2ff9a4513#a-few-words-about-reduxmvi) who's noticed Redux basically implements MVI, just using functions instead of objects.

But the data flow here is subtly different:

- Locally, components implement a loose, but reasonably well-defined MVI pattern to maintain state, using functional reactive programming to simplify the concept and plumbing.
	- "Model" = Component state (what state you define in the component)
	- "View" = What you render (what you return from the component)
	- "Intent" = Received events (your `receive` method handling any/all events)
	- Unlike in traditional MVI, you subscribe to UI intents in your view, not your model, and updated attributes are watched as an entirely separate type of "intent" as UI events. This makes it a little more optimizable and a little cleaner to separate.
	- It's not really possible to avoid this unidirectional intent-like data flow without things getting super awkward super fast, and that's by design.

- Components communicate to surrounding components as limited actors in a strict hierarchy, where:
	1. Components are only able to interact with their parent and children.
	1. The parent can send only a single type of message (attributes) to the child.
	1. The child can send multiple types of messages to the parent.

- Components communicate with external data models as usual in an unopinionated way. This can be traditional MVC, MVI/Redux, Meiosis, or whatever.

## Sugared components

This is exposed under named exports of `mithril/m` with each exposed in the core bundle.

- `component((attrs, context) => (attrs, prev) => view)`, exposed in the global bundle via `Mithril.component`.
	- `attrs` - The current attributes.
	- `prev` - The previous attributes or `undefined` if it's the first render.
	- `context` - The redraw context:
		- `context.context` - Set to the outer `context`.
		- `context.redraw()` - Schedule an explicit async redraw for this component.
		- `context.done = func` - Invoke `func` when this component is being removed.
	- This wraps all event handlers, including component event handlers, to schedule an auto-redraw if you return anything other than `false`.

- `pure((attrs, prev) => view)`, exposed in the global bundle via `Mithril.pure`.
	- `attrs` - The current attributes.
	- `prev` - The previous attributes or `undefined` if it's the first render.
	- Return `prev` directly if you want to retain the previous subtree.
	- This is just like `closure`, but sugars over attributes, too.
	- This does *not* schedule any redraws. If you need to redraw locally, it's not a pure component.
	- This is mostly sugar for `attrs => Stream.scanMap(attrs, undefined, (prev, attrs) => [attrs, view(attrs, prev)])`, but it doesn't have a dependency on [`mithril/stream`](mvp-utils#stream-utilities).

Note that this doesn't pierce through control vnodes and component vnodes to their children - it simply rewrites the returned vnode tree internally.

This is implemented [here](https://github.com/isiahmeadows/mithril.js/blob/redesign/packages/mithril/src/component.mjs).

### Why?

Sometimes, it's easier to think procedurally and method-oriented and in super stateful, relatively static components like controlled forms and inputs, it's often more concise.

```js
// Native stateful component
function Counter() {
	return (render) => {
		let count = 0
		redraw()
		function redraw() {
			render([
				m("button", {onclick() {count--; redraw() }}, "-"),
				m(".display", count),
				m("button", {onclick() {count++; redraw() }}, "+"),
			])
		}
	}
}

// Closure
const Counter = closure(() => {
	let count = 0
	return () => [
		m("button", {onclick: () => count--}, "-"),
		m(".display", count),
		m("button", {onclick: () => count++}, "+"),
	]
})
```

Also, it's just generally useful when you store your model entirely separate from the component and access it directly, something not uncommon in simpler apps.

### Open questions

Is this a common enough *need* (not simply *want*) to include in the core bundle? I'm leaning towards a yes, since it's *sometimes* more concise and a little more streamlined. However, that "sometimes" is really an "almost never" in practice based on my experimentation, with most use cases being either forms, model-driven components, or something similarly stateful, self-contained, and non-reactive. I've only once in the `src/` or `examples/` folders needed this, and even in many of the cases you'd expect, it's neither more concise nor necessarily more readable.

It's worth noting that optimizing the vnode rewriting mechanism can get slightly arcane at times, so it's probably better that it remains in core.
