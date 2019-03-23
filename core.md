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

### Why?

There's a few reasons:

- Components can be functions from a cell of attributes to a vnode tree, so lifecycle hook naturally fall from the model.
- This is what would be our answer to React Hooks, just substantially lower in overhead. And hey, you don't actually *need* a library to use this.
- Most streaming needs can directly translate to this.

Also, there's a handful of helpers [here](https://github.com/isiahmeadows/mithril.js/tree/v3-redesign/helpers) based on [some of these hooks](https://usehooks.com/), in case you want to know what it could look like in practice. Some of those use [some built-in utilities](mvp-utils.md#cell-utilities).

## Vnode inspection utilities

This is exposed in each component via a `Vnodes` object parameter.

- `Vnodes.tag(vnode)` - Get the resolved tag name or component reference.
- `Vnodes.attrs(vnode)` - Get the resolved attributes as an object, including `is` for customized built-in elements, `key` for the key, `ref` for the ref, and `children` for the resolved children. This does *not* return the original instance, but always a clone of it, and it never returns an empty object. It does *not* clone the children, so be aware of that.
    - This is mostly what components receive through the `attrs` cell.
    - Consider this the inverse of what's done to normalize attributes in `m("tag", attrs)`.
- `Vnodes.attr(vnode, key)` - Equivalent to `Vnodes.attrs(vnode)[key]`, but avoids the overhead of creating a full attributes object. Some attributes, like `is` (for customized built-in elements), `key`, `ref`, and `children`, are normalized in the representation, so this skips that for keys that don't really matter much.
- `Vnodes.attrKeys(vnode)` - Equivalent to `Object.keys(Vnodes.attrs(vnode))`, but avoids the overhead of creating a full attributes object. Some attributes, like `is`, `key`, `ref`, and `children`, require some unusual processing, so it would take a bit of extra processing to include them.
- `Vnodes.create(mask, tag, attrs, children, key, ref)` - The vnode factory
	- This function is intentionally *not* part of semver.
- `Vnodes.normalize(child)` - Normalize a single child into a vnode
- `Vnodes.normalizeChildren(children)` - Normalize an array of children into an array of vnodes

### Why?

Given that [vnode allocation and inspection now requires significant interpretation](vnode-structure.md), there needs to be some standard library functions for easily inspecting various properties of attributes.

## Components

- Components: `component(m, attrs, Vnodes): view`
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

The primary hyperscript API is still exposed as usual, just as an argument to components and to the initialization method of `Mithril.render`.

### Vnode types

- Element: `m("div", ...)`
	- `xmlns` sets the raw namespace to construct this with. For the DOM renderer, this by default just follows HTML's rules regarding namespace inference.
	- DOM attributes other than event handlers *may* be set to cells rather than raw values. This enables updates without actually performing a full diff, which is significantly faster. (We'll trash benchmarks that way, but it also just makes more sense in this model.)
	- This follows mostly the same hyperscript API as usual.
- Fragment: `m(":fragment", ...)`, `[...]`
- Keyed: `m(":keyed", ...)`
- Text: `m(":text", ...)`, `"..."`
- Trust: `m(":html", ...)`
- Control: `m(":control", {body: controlBody})`, `controlBody`
- Component: `m(Component, ...)`

When JSX users need to reference these names, they should just alias them locally, like `const Fragment = ":fragment"`. But in addition, they should set the following Babel JSX plugin options:

- `pragma` - `m`
- `pragmaFrag` - `":fragment"`

### Attributes

Attributes are the bread and butter of element manipulation. These are how things actually get reacted to, other than children. For DOM vnodes, this is how you update values, classes, and the like. For components, this is how you pass data and callbacks to them.

There are three special vnode attributes:

- `key` - This tracks vnode identity and serves two functions:
	- In `Keyed` children: linking an instance to a particular identity. This is how keyed fragments work today. Note that in this case, they're treated as object properties.
	- In other cases: linking an instance to a particular state. This is how single-item keyed fragments work, and it's diffed as part of the vnode's logical type.
- `ref` - This allows accessing the underlying DOM instance or provided component ref of a particular component or vnode.
- `children` - This is the attribute's list of children.

Attributes other than `key`, `children`, and event handlers (like `onclick` or a component's `onupdate`) *may* be set to cells rather than raw values. This simplifies a lot of attribute binding for components and DOM elements. Also, by side effect, it reduces a lot of our diff calculation overhead, but this isn't why I chose to allow this.

- For components, this emits a new set of attributes for that component.
- This gives us much of the benefits of a system like Glimmer's pre-compiled VM architecture without the tooling overhead.

### Refs

TODO: make this more sensible prose

- Create a ref: `const ref = (current = undefined) => ({current})`
	- Just simple sugar for when you want to create a ref. It's smaller than creating a full `{current: null}` object, so it's a little easier to use.
	- This is exposed from `mithril/ref` as its sole default export.

- Request element/ref access: `ref: {current}`
	- For element and text vnodes, `ref` is set to the backing DOM node. It's internally ignored on all other vnode types.
	- For trusted vnodes, `ref` is set to array containing the newly added DOM nodes.
	- For all other vnodes, `ref` is ignored. Mithril itself doesn't have any sensible value to set it to.
		- For component vnodes, `ref` is also not censored from the attributes. If there really *is* any interesting value for a ref, you should just set it directly from the attributes itself.
		- For control vnodes and fragments, Mithril *could* set to the list of nodes, but that list could include nested fragments and components, so it's debatable what values those could/should be.

TODO: make this more sensible prose

Notes:

- Refs are somewhat different from React's:
	- Refs are designed to be control mechanisms, not simply exposure mechanisms. They work more like a single-use token you can pass around and asynchronously query. Likewise, these are *not* saved in subsequent renders.
	- [React cares about ref identity](https://reactjs.org/docs/refs-and-the-dom.html#caveats-with-callback-refs), but this complicates the model a lot, especially when it's designed only for exposure.
	- You can see refs in action in [the TodoMVC example](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/examples/todomvc/view.mjs)
- Technically, I could just provide `vnode.dom` instead of `ref`, but there's three main reasons why I'm not:
	2. It's generally poor practice to try to mutate the DOM outside of event handlers (which provide it via `ev.target.value`) or a batched request. Forcing batching also keeps performance up and running.
	3. It makes it impossible to access an uninitialized element, simplifying types and avoiding potential for bugs.
	4. It complicates access for simpler cases.

### Why inject the factory and attribute methods?

1. It keeps the data representation independent of the component.
1. Components can just declare a peer dependency and support almost any version, even if it's a custom renderer that has practically nothing in common with standard Mithril.

## Control vnodes

Control vnodes are just wrapped [cells](#cells) which receive an extra `context` parameter - yes, really. This gives you a handle to update them manually, but easily. Note that trees can only be patched through the use of control vnodes.

When you "update" a control vnode, it detaches the previous control vnode's tree before initializing the new one, but invokes the `done` callback *after* the new one is first rendered. I can do this because I convert updates from invoking a `render` method to just emitting through a stream.

In case you're curious, yes, this effectively works as an explicit one-way binding mechanism.

- This is for when you need a fragment you can update manually.
- This simplifies a few things.
- This makes certain auto-binding patterns easier to specify.
- This can provide some prop-like magic behavior without actually being a significant maintenance or boilerplate problem.

### Rendering

Rendering takes one of two forms: `render((m, Vnodes) => vnode).then(...)` (invoking the first parameter). It schedules a subtree redraw for the current control vnode with a new tree.

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

- Get render type: `context.renderType()`
	- This is for cases like third party integration when you need to *not* invoke DOM-dependent libraries in server-side code.
	- This is used by `mithril/trust` to determine what to render.
	- This is returns `"html"` for `mithril/render-html` and `"dom"` for `mithril/render`
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

- Control vnodes are `(render, context) => done?` functions, optionally within the `body` of a `m(Control, {body})`.
- That `render` is a `render(view)`, which explicitly renders as necessary and returns a promise resolved once it's committed.
- `done` is invoked before removing and/or replacing the control vnode.
- `context` is an object with some helpful contextual methods, to enable and augment more advanced use cases:
	- `context.renderType()` - Return a descriptive string of the current rendering environment.
	- `context.renderSync(view)` - Like `render(view)`, but synchronous. Errors are thrown synchronously, and it just returns `undefined`.
	- `context.schedule(callback, cancel?)` - Schedule a callback for this context and resolve once it runs. Only one callback can be scheduled per context, so the previous one is cancelled first, invoking the previous `cancel` if applicable.

The full type for control vnodes is this:

```ts
// Depends on the types for `CellDone`
type ControlBody = (render: ControlRender, context: ControlContext) => void | CellDone;
type ControlRender = (children: ChildrenFactory) => Promise<void>;
type ChildrenFactory = (m: Hyperscript) => Children;

interface ControlContext {
	renderType(): string;
	renderSync(children: ChildrenFactory): void;
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

- `render(root, (m, Vnodes) => vnode)` - Render a tree to a root using an optional previous internal representation. This is exposed in the core bundle via `Mithril.render`.
	- If `root` is currently being redrawn, an error is thrown.
	- This is synchronous - it only makes sense to do it this way.
	- This assigns an expando `._ir` to the root if one doesn't exist already.

- `render(root)` - Clear a root.

- `hydrate(root, (m, Vnodes) => vnode)` - Renders a root vnode. This is exposed in the full bundle via `Mithril.hydrate`, but is *not* exposed in the core bundle. (It's tree-shaken out.)
	- This assigns an expando `._ir` to the root.

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

## Closure components

This is exposed under `mithril/component` and exposed via `Mithril.component`.

- `component((attrs, context) => (attrs, prev) => view)`
    - `attrs` - The current attributes.
    - `prev` - The previous attributes or `undefined` if it's the first render.
	- `context` - The redraw context:
		- `context.renderType()` - Delegates to the real `context.renderType()`.
		- `context.redraw()` - Schedule an async redraw.
		- `context.redrawSync()` - Perform a sync redraw.
		- `context.wrap(func)` - When `func` returns/resolves/rejects/throws, schedule an async redraw.
	- This is just like `closure`, but sugars over attributes, too.
	- This wraps all event handlers, including component event handlers, to schedule an auto-redraw if you return anything other than `false`.

Note that this doesn't pierce through control vnodes and component vnodes to their children - it simply rewrites the returned vnode tree internally.

Also, note that this must be from the same library version as `mithril/dom`.

This is implemented [here](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/component.mjs), with an optimized implementation [here](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/optimized/component.mjs).

### Why?

Sometimes, it's easier to think procedurally and method-oriented and in super stateful, relatively static components like controlled forms and some inputs, it's sometimes more concise.

```js
// Native reducer
function Counter() {
    return (context, count = 0) => [
        m("button", {onclick: () => context.update(count - 1)}, "-"),
        m(".display", count),
        m("button", {onclick: () => context.update(count + 1)}, "+"),
    ]
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

It's worth noting that the optimized variant's vnode rewriting mechanism dives into some arcane details about vnode representation to avoid slowdown while it tries to minimize copies.

## Core bundle

The core bundle, `mithril/core`, exposes the following:

- `render` from `mithril/dom` (but not `hydrate`)
- `component` from `mithril/component`
- `ref` from `mithril/ref`

## General notes

- This separation keeps it a little more clearly tree-shakable and more cleanly abstracted.
- The global bundle is exported via a `Mithril` global.
