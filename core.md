[*Up*](./README.md)

# Core

Core would change considerably, but this is to simplify the API and better accommodate components.

## Goals

- Libraries should be largely independent of where it gets its Mithril state. This is why `render` and `context` are passed as parameters rather than being global.
	- This means code can be isomorphic with almost no effort, even if they involve a *lot* of complicated state initialization.
	- It would also let me experiment with making a renderer that operates entirely off the main thread, keeping that exclusively for DOM computation and event management.
- It should be as concise as pragmatically possible, yet still remain actual JS. This guided my decision to make this heavily functional.
- It should be fast - not for simple hand-tuned code, but for the code you'd write normally anyways.

## Cells

You'll see these referenced quite a bit, so here's a quick explainer.

Cells are simple `(send) => done?` functions.

- `done(): any` is called when the cell is being cleaned up. It's simply called, not awaited, so be aware of that.
	- Note: when changing context (like if the attributes change or similar), this does *not* get called, and the corresponding state is still propagated.
- `send(value)` allows emitting values.
	- In vnodes, the `value` is your vnode children. This *may* return a promise resolved after it's handled.
- The cell is only initialized once.
- Conveniently, this can be used as a control vnode, and it's special-made for it. You can use these to create simple reactive cells that control their own updating.

The full type of cells is this:

```ts
type Cell<T> = (send: CellSend<T>) => void | CellDone;
type CellSend<T> = (value: T) => void | Promise<void>;
type CellDone = () => any;
```

This is purely a convention commonly used throughout the API. This is heavily inspired by React Hooks, but aims to keep the runtime overhead to a minimum. It also is not present in the core bundle because 99% of uses can generally just be written as a design pattern. And of course, there's a heavy FP inspiration here, but a pragmatic, impure one.

### How you create cells

Cells are simple functions that take a required `send` method and return an optional `done` method. They conceptually just send values from the cell to be eventually listened to, and that listener calls the returned `done` whenever it's done receiving events.

```js
const cell = (send) => {
	// These aren't the only things you can do - it's pretty flexible.
	listenToSomething(thing, event => send(event)) // Send events
	for (const value of iter) send(value) // Send a list of values
}
```

### How you transform cells

Cell transforms take one or more cells (and maybe other parameters like a mapping function or a value) and return a new cell. Basically, something like this most of the time:

```js
function transform(cell, ...args) {
	return (send) => {
		// These aren't the only things you can do - it's pretty flexible.
		listenToSomething(thing, value => send(value))
	}
}
```

### Why?

There's a few reasons:

- Components can be functions from a cell of attributes to a vnode tree, so lifecycle hooks naturally fall from the model.
- This is part 1 of our answer to React Hooks, just substantially lower in overhead. And hey, you don't actually *need* a library to use this.
- Most streaming needs can directly translate to this.

Also, there's a handful of helpers [here](https://github.com/isiahmeadows/mithril.js/tree/v3-design/helpers) based on [some of these hooks](https://usehooks.com/), in case you want to know what it could look like in practice. Some of those use [some built-in utilities](mvp-utils.md#cell-utilities).

### What about streams?

Streams have an explicit ability to end themselves. Cells cannot, and this inability aligns better with the fact components can't remove themselves in the model of virtual DOM frameworks - only a parent component can remove a child component.

In addition, cells are purely a function-based design pattern. They require no library at the lowest level, so Mithril can operate on these without any special dependencies.

## Components

- Components: `component(attrs): view`
	- Component attributes are a cell containing each attribute.
	- Component views are simply vnode children. Conveniently, this *does* include state cells.
- Components simply map attributes to a view. Mithril only cares about them in that it can more intelligently diff things.
- Intentionally, components do have a friendly API that works even if you choose to use it not as a component.
- If you want to actually update the view, use a control vnode
- Refs on components pass through to the component's body.
- If you want to remember attributes, store them in the state.
- If you want to remember old attributes or state, store them in the new state.
- Note: incoming vnode children are accessible via `attrs.children`.
- Note: attributes support multiple `send` callbacks. So you can do things like have multiple `Cell.map(attrs, ...)` in your view, without issue.

### Why separate the updating from components?

There's a few reasons:

1. Instead of component attributes being stored on the internal model, it's stored in a closure (the control vnode's body) that implicitly gets replaced on update. In many cases, this provides a substantial memory win, since in practice, attributes are often not necessary.
2. This *only* updates when the attributes have to update. This cuts down *tremendously* on redraw times, so auto-redraws are never global.
2. Updating can happen anywhere, and it doesn't matter where it is as long as the tree is updated appropriately. This brings a lot of added flexbility.
3. Components now only serve one master: abstraction. Control components serve the single master of enabling subtree updates.

If you've ever used [React Redux](https://react-redux.js.org/) or [Cycle.js](https://cycle.js.org) and you squint hard enough, you can see a mild resemblance [to](https://redux.js.org/basics/usage-with-react) [both](https://cycle.js.org/#-example). Yes, both of these are partial inspirations, but this is also partially just a superficial coincidence:

- TODO: detail this

If you've used [React Redux](https://react-redux.js.org/) and you squint hard enough, [you can see a mild resemblance to it](https://redux.js.org/basics/usage-with-react), yes, that was a partial inspiration. But this is also partially coincidence due to similar concerns:

- Incoming attributes are treated very similarly a Redux action dispatch.
- State is treated much like Redux component props.
- Unlike React Redux, this provides the previous state (their props) when receiving attributes (their action). This keeps the view logic within the component, which just makes more sense.
- Unlike React Redux, this fuses dispatch with rendering, so it avoids all the overhead of going through a full store and back.

I've used React Redux in a few boilerplates and seen several other React Redux projects, and yes, reducers are *very* commonly used as [cells in an MVI architecture](http://hannesdorfmann.com/android/mosby3-mvi-3). This is a partial inversion of that architecture, where:

- The view is fused with the "model"
- The view is specified together with its model
- The reducer `receive` is receiving intents in the form of attributes

## Vnodes

### Hyperscript API

The primary hyperscript API is still exposed as usual via `mithril/m` and `Mithril.m` in the core bundle.

### Vnode types

- Hole: `null`/`undefined`/`true`/`false`
- Element: `m("div", ...)`
	- `xmlns` sets the raw namespace to construct this with. For the DOM renderer, this by default just follows HTML's rules regarding namespace inference. Note that this sets the implicit namespace to use for child nodes, too.
	- DOM attributes other than event handlers *may* be set to cells rather than raw values. This enables updates without actually performing a full diff, which is significantly faster. (We'll blow benchmarks out of the water that way, but it also just makes more sense in this model.) Note that this doesn't carry over to components.
	- This follows mostly the same hyperscript API as usual.
- Fragment: `m("#fragment", ...)`, `[...]`
- Keyed: `m("#keyed", ...)`
- Text: `"..."`
- Trust: `m("#html", ...)`
- Catch: `m("#catch", {onerror}, ...)`
	- `onerror(e)` is called with every exception in that subtree that propagates to Mithril's renderer from user code.
	- This exists mainly for error reporting.
	- You can propagate an error upward by rethrowing it.
	- When an error propagates past a subtree, that subtree is synchronously removed with inner `done` callbacks invoked. (Errors in those are added to the error list, and the list will be eventually rethrown in a property of a synthetic error.)
- Control: `controlBody`
- Component: `m(Component, ...)`

If you're a JSX user needing to reference these names, you should just alias them locally, like `const Fragment = "#fragment"`. But in addition, you should set the following Babel JSX plugin options when using `@babel/preset-react`:

- `pragma: "m"`
- `pragmaFrag: "'#fragment'"`

Or if you're using the `@jsx` and `@jsxFrag` special comments, you should use `/* @jsx m @jsxFrag "#fragment" */`.

### Attributes

Attributes are the bread and butter of element manipulation. These are how things actually get reacted to, other than children. For DOM vnodes, this is how you update values, classes, and the like. For components, this is how you pass data and callbacks to them.

There are three special name vnode attributes:

- `key` - This tracks vnode identity and serves two functions:
	- In `"#keyed"` children: linking an instance to a particular identity. This is how keyed fragments work today. Note that in this case, they're treated as object properties.
	- In other cases: linking an instance to a particular state. This is how single-item keyed fragments work, and it's diffed as part of the vnode's logical type.
- `ref` - This allows accessing the underlying DOM instance or provided component ref of a particular component or vnode.
- `children` - This is the attribute's list of children.
	- Children are always normalized to an array, even if just an empty array and even if it's for a component vnode. Note that the selector and attributes still take precedence over any children parameters.

On DOM elements, attributes other than event handlers, `key`, `is`, `children`, and `ref` *may* be set to cells rather than raw values. This simplifies a lot of attribute binding for DOM elements. Also, by side effect, it sidesteps a lot of our diff calculation overhead, but this isn't why I chose to allow this. It gives us much of the benefits of a system like Glimmer's pre-compiled VM architecture without the tooling overhead.

Note that the hyperscript API always normalizes attributes to an object, even if it's an empty one. The renderer expects and assumes this.

### Refs

- Request element/ref access: `ref: (elem) => ...`
	- For element vnodes, `ref` is called with the backing DOM node. It's internally ignored on all other vnode types.
	- For trusted vnodes and fragments, `ref` is called with an array containing the newly added DOM nodes.
	- For components, `ref:` is ignored and it's also not censored from the attributes. If there really *is* any interesting value for a ref, you should call it directly in the component itself.

Notes:

- Refs are somewhat different from React's:
	- Refs are always invoked on every update that reaches them, as they're not simply exposure mechanisms but also control mechanisms.
	- [React cares about ref identity](https://reactjs.org/docs/refs-and-the-dom.html#caveats-with-callback-refs), but this complicates the model a lot, especially when it's designed only for exposure.
	- You can see refs in action in [the TodoMVC example](https://github.com/isiahmeadows/mithril.js/blob/v3-design/examples/todomvc/view.mjs).
- Technically, I could just provide `vnode.dom` + an `oncreate`/`onupdate` equivalent instead of `ref`, but there's four three reasons why I'm not:
	1. It's generally poor practice to try to mutate the DOM outside of event handlers (which provide it via `ev.target.value`) or a batched request. Forcing batching also keeps performance up and running.
	2. It makes it impossible to access an uninitialized element, simplifying types and avoiding potential for bugs.
	3. It complicates access for simpler cases.
	4. 1 hook is better than 2. I'd need a hook for `oncreate`/`onupdate` anyways, so it's much simpler to do it this way.

### Selectors

Selectors are mostly the same, but the tag name is now always required.

- `m(".class")` &rarr; `m("div.class")`
- `m("#id")` &rarr; `m("div#id")`
- `m("[attr=value]")` &rarr; `m("div[attr=value]")`

There's three reasons I mandate this:

- It's one of the biggest stumbling blocks people have had with selectors. I see this as a frequent stumbling block that people write `m(".foo")` instead of `m("span.foo")` and wonder why things aren't working. The implicit default clearly is tripping people up, and the common case is only really saving 3 characters for something that you're more often changing than writing to begin with. (Hyperscript isn't exactly Emmet.)
- It avoids the question of what to do with `m("")` - if you follow the rules logically, it's equivalent to `m("div")`, but intuitively, for many, it's equivalent to `null`.
	- Relevant GitHub issue: [#723](https://github.com/MithrilJS/mithril.js/issues/723)
	- Relevant Gitter discussion: [11 Dec 2015](https://gitter.im/mithriljs/mithril.js/archives/2015/12/11), [12 Dec 2015](https://gitter.im/mithriljs/mithril.js/archives/2015/12/12)
- It's less implicit information you have to keep in mind and infer. If it says `div`, you know at a glance it's a `<div>` that it renders to. 99% of development isn't writing, but reading, and that "at a glance" information is incredibly valuable to have. I find myself, as a Mithril maintainer, taking twice as long to process `m(".widget")` than `m("button.confirm")` or even `m("div.widget")`. Even though it's still pretty quick for me, I have to stop and mentally reparse after reading the tokens (the implied `div` in `div.widget` rather than just being decorated `widget`) as my brain reads the word before realizing that's the class name and not the tag name.

## Why keep vnodes JSON-compatible?

This is in large part due to disagreement with [React's decision to block it](https://overreacted.io/why-do-react-elements-have-typeof-property/) somewhat. They make security claims, but I'm not convinced they're serious in any remotely sane set-up:

- They note that it's *very* difficult to block arbitrary JavaScript in general and that their defense could still be penetrated in many circumstances.
- Some of the potential vulnerabilities they claim exist are almost certainly *not* exploitable in practice.
	- The section on "[...] if your server has a hole that lets the user store an arbitrary JSON object while the client code expects a string, [...]" is itself fairly niche, and even in this case, you almost always do further processing before rendering the value.
	- It notes pretty clearly it *doesn't* protect against things like `href: "javascript:doSomethingReallyEvil()"` or spreading untrusted attributes.
	- Most of the hypotheticals are just about things frameworks already address, like unescaped strings and the like.
- The obvious case of an object without a `.tag` is already rejected for reasons other than this, but it'd also catch 99% of the issues that'd really occur in practice, including some I've encountered personally.

## Control vnodes

Control vnodes are just wrapped [cells](#cells) which receive an extra `context` parameter - yes, really. This gives you a handle to update them manually, but easily. Note that trees can only be patched through the use of control vnodes.

When you "update" a control vnode, it detaches the previous control vnode's tree before initializing the new one, but invokes the `done` callback *after* the new one is first rendered. I can do this because I convert updates from invoking a `render` method to just emitting through a stream.

In case you're curious, yes, this effectively works as an explicit one-way binding mechanism.

- This is for when you need a fragment you can update manually.
- This simplifies a few things.
- This makes certain auto-binding patterns easier to specify.
- This can provide some prop-like magic behavior without actually being a significant maintenance or boilerplate problem.

### Rendering

Rendering takes one of two forms: `render(vnode).then(...)` (invoking the first parameter). It schedules a subtree redraw for the current control vnode with a new tree.

- This schedules a subtree redraw for the relevant control vnode.
- `vnode` is the children to write.
- This commits asynchronously, but is *not* guaranteed beyond that.
- This is mostly just sugar for `context.scheduleLayout(() => context.renderSync(vnode))`, but async renders are run *before* the callbacks scheduled via `scheduleLayout`. So do note that.

Async rendering frames operate in this order for each root being redrawn:

1. Update the root's subtree with the given updated trees. If a child has an updated tree after sending new attributes, that subtree is updated, too.
	1. Each update is attached to a fragment and added to the DOM immediately after this step.
1. Invoke all `scheduleLayout` callbacks in order of appearance.
1. Invoke all cell `done` callbacks in order of appearance.
1. Invoke all vnode `ref` callbacks in order of appearance.

### Context

In addition to the `render` callback, there's an additional `context` parameter passed to the control vnode's body, with a few useful methods for more advanced cases.

- Get render info: `context.renderInfo`
	- This is for cases like third party integration when you need to *not* invoke DOM-dependent libraries in server-side code. The data here is considered static and is almost always going to be global to that module.
	- There are only two required properties, `isStatic` and `type`, but third-party renderers can add anything else they like.
		- `isStatic` - `true` if the result is being rendered once to a serialized string, `false` otherwise.
		- `type` - A descriptive string uniquely referring to this renderer. This doesn't need to be unique to all entry points, but only to the backing renderer itself - a native renderer should *not* return `"dom"`, for example.
	- When `mithril/render-html` is used:
		- `context.renderInfo.isStatic` is set to `true`
		- `context.renderInfo.type` is set to `"html"`
	- When `mithril/render` is used:
		- `context.renderInfo.isStatic` is set to `false`
		- `context.renderInfo.type` is set to `"dom"`
- Update view sync: `context.renderSync(factory)`
	- This is similar to `render(factory)`, but operates synchronously and either synchronously throws or synchronously returns `undefined`.
	- An error is thrown if this tree is currently being redrawn or this control vnode's body is being invoked. (As in, this does not support recursive invocations.)
	- This is intended to support things that require [DOM calculation or similar](https://github.com/MithrilJS/mithril.js/issues/1166#issuecomment-234965960) immediately after rendering.
- Schedule a render callback: `context.scheduleLayout(callback, cancel?).then(...)`
	- This returns a promise resolved when completed.
	- The callback is always called asynchronously relative to the cell, but *not* necessarily relative to the global event loop. In particular:
		- Calls scheduled during initialization are scheduled to run right after refs are set.
		- Calls scheduled at any other point in time are scheduled for the next frame.
	- In the callback, it's safe to synchronously render.
	- If a previous callback was scheduled for this context, it's dropped and `cancel` is called (if given).
	- If a parent context schedules a callback, this callback is ignored and `cancel` is called (if given).
	- When cancelled, the returned promise is dereferenced and never resolved.
	- This is for those rare cases where you need to run layout computation or similar before explicitly committing a tree.
		- In general, when you run this, you will also generally want to call `context.renderSync(vnode)`.
		- This method has a verbose, slightly obscure name for a reason: you should generally question every use of it. The core `mithril/component` needs it for properly scheduling async redraws, but very little else does.

### API Summary

In short:

- Control vnodes are `(render, context) => done?` functions.
- That `render` is a `render(view)`, which explicitly renders as necessary and returns a promise resolved once it's committed.
- `done` is invoked before removing and/or replacing the control vnode.
- `context` is an object with some helpful contextual methods, to enable and augment more advanced use cases:
	- `context.renderType` - A key/value object describing current rendering environment.
	- `context.renderSync(view)` - Like `render(view)`, but synchronous. Errors are thrown synchronously, and it just returns `undefined`.
	- `context.scheduleLayout(callback, cancel?)` - Schedule a callback for this context and resolve once it runs. Only one callback can be scheduled per context, so the previous one is cancelled first, invoking the previous `cancel` if applicable.

The full type for control vnodes is this:

```ts
// Depends on the types for `CellDone`
type ControlBody = (render: ControlRender, context: ControlContext) => void | CellDone;
type ControlRender = (children: Children) => Promise<void>;

interface ControlContext {
	renderInfo: {
		isStatic: boolean;
		type: string;
	};
	renderSync(children: Children): void;
	scheduleLayout(callback: () => any, cancel?: () => any): Promise<void>
}
```

### What happened to lifecycle methods?

Those have been split into two parts:

- `oncreate`/`onupdate`/`onremove` - `context.scheduleLayout` + refs
- `onremove` - Your returned `done` callback from control vnodes.
- `oninit` - Just put the state in your cell.
- `onbeforeupdate` - If nothing changed, just don't update. If you'd like some sugar for this, there's a `distinct(cell, by?)` method in [the core cell utilities](mvp-utils.md#cell-utilities) that you can use for equivalent effect.
- `onbeforeremove` - In the attributes, set an option to start the transition, then remove the vnode after it completes. [I do plan to expose a built-in utility for assisting with this](mvp-utils.md#transition-api) as part of the MVP, and the hard part of doing this for lists is [another component I want to include](future-utils.md#list-transition-api), just not required for the MVP itself.

It's worth noting we're currently the exception, not the norm, in baking async removal into core. Angular, React, Vue, and even Polymer require that async removal occurs with the explicit awareness of the parent. And it's not like we don't ourselves have catches in this: async removal only awaits the top-level vnode being removed. Anything else, even in Mithril, requires cooperation between parent and child.

The solution to async removal without framework support is through an intent system:

1. Set a flag on a component when you're about to remove it. That component should then do whatever it needs to do first, like toggle a class.
1. Once the component has done the necessary processing (like after the animation runs), it should invoke a callback to signal it's ready to be removed.
1. Finally, remove the node itself.

## DOM renderer API

This is mostly the existing renderer API, but with some modifications. It's exposed via `mithril/dom`.

- `render(root, attrs?, ...children)` - Render attributes + a tree to a root. This is exposed in the core bundle via `Mithril.render`.
	- If `root` is currently being redrawn, an error is thrown.
	- This is synchronous - it only makes sense to do it this way.
	- This assigns an expando `._ir` to the root if one doesn't exist already.

- `render(root)` - Clear a root.

- `hydrate(root, attrs?, ...children)` - Hydrates attributes + a tree to a root. This is exposed in the full bundle via `Mithril.hydrate`, but is *not* exposed in the core bundle. (It's tree-shaken out.)
	- This assigns an expando `._ir` to the root.

- `abortable((signal, render, context) => ...)` - Invokes a callback with an abort signal (ponyfilled with something that works with `mithril/request` if necessary) that's called on `done` and ignores the return value (useful if it's a simple async arrow function). This returns a cell and is useful with `fetch` and `mithril/request` for cleaning up requests, and it's a pretty simple utility.

Notes:

- For `render`:
	- First renders are always synchronous. Subsequent renders await async unmounting before rendering subtrees. (This avoids certain async complications.)
	- If any subtree redraws are scheduled, they are cleared to make room for the global redraw.
	- This depends on `window` and `document` globals - those are *not* dependency-injected. This does *not* include module instantiation, so it's safe to load without side effects on server-side.
	- Callbacks are deduplicated via `requestAnimationFrame` on update, requesting a time slot to update the DOM tree before committing. This is intentionally coupled to the renderer as it has some non-trivial deduplication logic to ensure trees get merged with their ancestors when their updates get scheduled.

- For `hydrate`:
	- An error is thrown if `root._ir` already exists.
	- An error is thrown if any differences exist between the existing DOM tree the incoming vnode tree.
	- If an error is thrown at any point, all successfully added removal hooks are called immediately before throwing the caught error. If any of these throw, their errors replace the initially caught error and are rethrown instead.
	- This shares a lot of code with `render`, hence why they're in the same module.

- For `abortable`:
	- This only exists here instead of `mithril/component` because it relies on certain DOM checks, and I'd rather keep everything in core with explicit DOM dependencies constrained to `mithril/dom` for architectural reasons, including easier usage with Node.

### Why allow attributes to be specified inline?

It makes it much easier in several circumstances to just sprinkle in a little bit of Mithril onto a page, since you could just render some attributes. It also makes a few things like portals a little easier to come by.

And from a code standpoint, it's not hard - it's as easy as just moving the internal entry point from a retained unkeyed fragment to a retained unkeyed element.

## Sugared components

This is exposed under `mithril/component` with each exposed in the core bundle.

- `component((attrs, context) => (attrs, prev) => view)`, exposed in the global bundle via `Mithril.component`.
	- `attrs` - The current attributes.
	- `prev` - The previous attributes or `undefined` if it's the first render.
	- `context` - The redraw context:
		- `context.renderInfo` - Set to the outer `context.renderInfo`.
		- `context.redraw()` - Schedule an explicit async redraw for this component.
		- `context.redrawSync()` - Perform a sync redraw for this component.
		- `context.onDone = func` - Invoke `func` when this component is being removed.
	- This wraps all event handlers, including component event handlers, to schedule an auto-redraw if you return anything other than `false`.

- `pure((attrs, prev) => view)`, exposed in the global bundle via `Mithril.pure`.
	- `attrs` - The current attributes.
	- `prev` - The previous attributes or `undefined` if it's the first render.
	- Return `prev` directly if you want to retain the previous subtree.
	- This is just like `closure`, but sugars over attributes, too.
	- This does *not* schedule any redraws. If you need to redraw locally, it's not a pure component.
	- This is mostly sugar for `attrs => Cell.scanMap(attrs, undefined, (prev, attrs) => [attrs, view(attrs, prev)])`, but it doesn't have a dependency on [`mithril/cell`](mvp-utils#cell-utilities).

Note that this doesn't pierce through control vnodes and component vnodes to their children - it simply rewrites the returned vnode tree internally.

This is implemented [here](https://github.com/isiahmeadows/mithril.js/blob/v3-design/src/component.mjs).

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

## Core bundle

The core bundle, `mithril/core`, exposes the following under the `Mithril` namespace and as a UMD module:

- `m` from `mithril/m`
- `render` and `abortable` from `mithril/dom` (but not `hydrate`)
- `component` and `pure` from `mithril/component`

## General notes

- This separation keeps it a little more clearly tree-shakable and more cleanly abstracted.
- The global bundle is exported via a `Mithril` global.
