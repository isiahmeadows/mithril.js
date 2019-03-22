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

### Why separate the updating from components?

There's a few reasons:

1. Instead of component attributes being stored on the internal model, it's stored in a closure (the control vnode's body) that implicitly gets replaced on update. In most cases, this provides a substantial memory win, since in practice, attributes are often not necessary.
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

- Element: `m("div", ...)`
	- `xmlns` sets the raw namespace to construct this with.
	- DOM attributes other than event handlers *may* be set to cells rather than raw values. This enables updates without actually performing a full diff, which is significantly faster. (We'll trash benchmarks that way, but it also just makes more sense in this model.)
- Fragment: `m(Fragment, ...)`, `[...]`
- Keyed: `m(Keyed, ...)`
- Text: `m(Text, ...)`, `"..."`
- Raw: `m(Raw, {length = 1}, [...])`
	- Children may either be nodes (when rendering to DOM) or strings (when rendering to string).
	- This is retained as long as the children array remains the same. Note that you *should not* insert siblings between the managed children - you should use a fragment of raw vnodes instead.
	- If the node is a fragment, the fragment's length *is* tracked accordingly.
	- The underlying renderer decides what `elem` should be.
	- This replaces `m.trust` - you should instead do one of the following:
		- Set `innerHTML` directly. 99.999999% of the time, this is sufficient. It's worth noting React, as popular as it is, only lets you do this.
		- Create a node, set `innerHTML` into it, and copy its children into a fragment, and return the fragment in a raw vnode. (This is what Mithril v1 and v2 do internally, and it's what the [built-in `Trust` component](mvp-utils.md#trusted-vnodes) does.)
	- It's *highly* advised that you diff the attributes appropriately here.
    - This is partially to integrate better with certain third-party utilities that [return their own DOM nodes](https://fontawesome.com/how-to-use/with-the-api/setup/getting-started) for you to add.
- Control: `m(Control, {body: controlBody})`, `controlBody`
- Request element/ref access: `ref: (elem) => ...`, `ref: (value) => ...`, etc.
	- For component vnodes, `ref` is ignored and has no special semantics. If there really *is* any interesting value for a ref, you should just call it directly from the attributes itself.
	- For element and text vnodes, `ref` is called with the backing DOM node. It's internally ignored on all other vnode types.
	- For keyed and unkeyed fragments, `ref` is called with no arguments.
	- For control vnodes, `ref` is ignored as their body itself functions not unlike one.
	- For raw vnodes, `ref` is ignored. You already have the underlying value, so it's pointless to have a reference.
	- The callback is scheduled to run after rendering or in the next frame.
	- There's a `Mithril.Ref` utility for combining and composing refs a little more easily. This is particularly useful when dealing with lists of refs and when dealing with forms.

Notes:

- There are two special vnode attributes:
	- `key` - This tracks vnode identity and allows two functions:
		- In `Keyed` children, linking an instance to a particular identity. This is how keyed fragments work today.
		- In other cases, linking an instance to a particular state. This is how single-item keyed fragments work.
	- `ref` - This allows accessing the underlying DOM instance or provided component ref of a particular component or vnode.
- Attributes other than event handlers (like `onclick` or a component's `onupdate`) and special keys (`key` and `ref`) *may* be set to cells rather than raw values. This simplifies a lot of attribute binding for components and DOM elements. Also, by side effect, it reduces a lot of our diff calculation overhead, but this isn't why I chose to allow this.
	- This gives us much of the benefits of a system like Glimmer's pre-compiled VM architecture without the tooling overhead.
- Vnode keys in `Keyed` are tracked like keyed fragments today
- Vnode keys in all other cases are diffed as part of the logical "tag name"
- Vnode keys are treated as object properties. Don't assume they're compared by literal identity, but treat them as if they're compared by property identity.
- Vnode children are stored in `attrs.children`
	- If no children exist and no `attrs.children` property is passed, this is set to an empty array.
- There is no `vnode.text` - it's `children: ["..."]` for `trust`/`text` and `children: [m(text, "...")]` elsewhere
- An error would be thrown during normalization if a child is an object without a numeric `.mask` field.
- Refs are somewhat different from React's:
	- Refs are designed to be control mechanisms, not simply exposure mechanisms. They work more like a single-use token you can pass around and asynchronously query. Likewise, these are *not* saved in subsequent renders.
	- [React cares about ref identity](https://reactjs.org/docs/refs-and-the-dom.html#caveats-with-callback-refs), but this complicates the model a lot, especially when it's designed only for exposure.
- Technically, I could just do `Promise.resolve().then(callback)` and provide `vnode.dom` instead of `ref`, but there's four main reasons why I'm not:
	1. I wouldn't be able to convert errors within the callback to a more informative rejection.
	2. It's generally poor practice to try to mutate the DOM outside of event handlers (which provide it via `ev.target.value`) or a batched request. Forcing batching also keeps performance up and running.
	3. It makes it impossible to access an uninitialized element, simplifying types and avoiding potential for bugs.
	4. It slightly complicates access for simpler cases.

## Control vnodes

Control vnodes are just wrapped [cells](#cells) which receive an extra `context` parameter - yes, really. This gives you a handle to update them manually, but easily. Note that trees can only be patched through the use of control vnodes.

When you "update" a control vnode, it detaches the previous control vnode's tree before initializing the new one, but invokes the `done` callback *after* the new one is first rendered. I can do this because I convert updates from invoking a `render` method to emitting through a stream, and I convert updates to *just* .

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
- This is technically just sugar for `context.schedule(() => context.renderSync(vnode))`, but it can be optimized for internally. (For example, when synchronously called, it can just store the tree and recurse.)

### Context

In addition to the `render` callback, there's an additional `context` parameter passed to the control vnode's body, with a few useful methods for more advanced cases.

- Get render type: `context.renderType()`
	- This is for cases like third party integration when you need to *not* invoke DOM-dependent libraries in server-side code.
	- This is used by `mithril/trust` to determine what to render.
	- This is returns `"html"` for `mithril/render-html` and `"dom"` for `mithril/render`
- Update view sync: `context.renderSync(vnode)`
	- This is similar to `render(vnode)`, but operates synchronously and either synchronously throws or synchronously returns `undefined`.
	- An error is thrown if this tree is currently being redrawn or this control vnode's body is being invoked. (As in, this does not support recursive invocations.)
	- This is intended to support things that require [DOM calculation or similar](https://github.com/MithrilJS/mithril.js/issues/1166#issuecomment-234965960) immediately after rendering.
- Schedule a render callback: `context.scheduleLayout(callback, cancel?).then(...)`
	- This returns a promise resolved when completed.
	- The callback is always called asynchronously relative to the cell, but *not* necessarily relative to the global event loop. In particular:
		- Calls scheduled during initialization are scheduled to run right before ref callbacks.
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
type ControlRender = (children: Children) => Promise<void>;

interface ControlContext {
	renderType(): string;
	renderSync(children: Children): void;
	scheduleLayout(callback: () => any, cancel?: () => any): Promise<void>
}
```

### What happened to lifecycle methods?

Those have been split into two parts:

- `oncreate`/`onupdate`/`onremove` - `ref` attributes
- `onremove` - Your returned `done` callback from both ref callbacks and control vnodes.
- `oninit` - Just put the state in your cell.
- `onbeforeupdate` - If nothing changed, just don't update. If you'd like some sugar for this, there's a `distinct(cell, by?)` method in [the core cell utilities](mvp-utils.md#cell-utilities) that you can use for equivalent effect.
- `onbeforeremove` - In the attributes, set an option to start the transition, then remove the vnode after it completes. [I do plan to expose a built-in utility for assisting with this](mvp-utils.md#transition-api) as part of the MVP, and the hard part of doing this for lists is [another component I want to include](future-utils.md#list-transition-api), just not required for the MVP itself.

It's worth noting we're currently the exception, not the norm, in baking async removal into core. Angular, React, Vue, and even Polymer require that async removal occurs with the explicit awareness of the parent. And it's not like we don't ourselves have catches in this: async removal only awaits the top-level vnode being removed. Anything else, even in Mithril, requires cooperation between parent and child.

The solution to async removal without framework support is through an intent system:

- Set a flag on a component when you're about to remove it. That component should then toggle a class as necessary.
- Set a flag on

## Hyperscript API

This is the existing hyperscript API, exposed via exports of `mithril/m`. Each of these are exposed from the browser bundle with properties of the same name.

- `m`/`default` - The hyperscript factory
- `Fragment`, `Keyed`, `Text`, `Trust`, `Retain` - Built-in components
- `create(mask, tag, attrs, children, key, ref)` - The vnode factory
- `RETAIN_MEMO` - A reference to the memoized `m(Retain)`, for `mopt`
- `normalize` - Normalize a single child into a vnode
- `normalizeChildren` - Normalize a child or array of children into an array of vnodes

Note: as an added bonus, this works better with Rollup, too.

## DOM renderer API

This is mostly the existing renderer API, but with some modifications. It's exposed via `mithril/render` and depends on `mithril/m`.

- `render(root, vnode?)` - Render a tree to a root using an optional previous internal representation. This is exposed via `Mithril.render`.
	- If `root` is currently being redrawn, an error is thrown.
	- This is synchronous - it only makes sense to do this.
	- `sync:` is a boolean option, but it does *not* result in a non-promise return value or synchronously thrown error. So this function is sometimes-sync in when side effects occur, but it *never* is sometimes-sync in error handling.
	- This assigns an expando `._ir` to the root if one doesn't exist already.

- `new Context(ir)` - Create a context instance from an IR node.
	- This exists mostly for `hydrate`.

Notes:

- First renders are always synchronous. Subsequent renders await async unmounting before rendering subtrees. (This avoids certain async complications.)
- If any subtree redraws are scheduled, they are cleared to make room for the global redraw.
- This depends on `window` and `document` globals - those are *not* dependency-injected. This does *not* include module instantiation, so it's safe to load without side effects on server-side.
- Callbacks are deduplicated via `requestAnimationFrame` on update, requesting a time slot to update the DOM tree before committing. This is intentionally coupled to the renderer as it has some non-trivial deduplication logic to ensure trees get merged with their ancestors when their updates get scheduled.

## DOM hydration API

The DOM hydration API is exposed under `mithril/hydrate` and is exposed via `Mithril.hydrate`. It depends on `mithril/render` and `mithril/m`.

- `hydrate(root, vnode?)` - Renders a root vnode.
	- This assigns an expando `._ir` to the root if one doesn't exist already.

Notes:

- An error is thrown if `root._ir` already exists.
- An error is thrown if any differences exist between the existing DOM tree the incoming vnode tree.
- If an error is thrown at any point, all successfully added removal hooks are called immediately before throwing the caught error. If any of these throw, their errors replace the initially caught error and are rethrown instead.
- This shares a lot of internal subscription code with `mithril/render`, so those need to share a common backend.

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
		- `ref` - Set the current ref. If it changes
	- This is just like `closure`, but sugars over attributes, too.
	- This wraps all event handlers, including component event handlers, to schedule an auto-redraw if you return anything other than `false`.

Note that this doesn't pierce through control vnodes and component vnodes to their children - it simply rewrites the returned vnode tree internally.

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

## General notes

- This separation keeps it a little more clearly tree-shakable and more cleanly abstracted.
- The global bundle is exported via a `m` global.
