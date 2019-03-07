[*Up*](./README.md)

# Core

Core would change considerably, but this is to simplify the API and better accommodate components.

## Goals

- Libraries should be largely independent of where it gets its Mithril state. This is why `context` is passed as a parameter to components.
- It should be as concise as pragmatically possible, yet still remain actual JS. This guided my decision to offer both reducer and closure variants.

## State reducers

You'll see these referenced quite a bit, so here's a quick explainer.

State reducers are simple `(context, state = undefined) => {state, value, ref?, done?}` methods.

- `context` is a full [vnode context](core.md#context).
	- Note that if you wrap this for your own purposes, make sure it's either persistent, it always delegates to one (at least indirectly), or both. Utilities *will* rely on this, including built-in ones.
- `state` is the state accumulator. You accept the previous value and return the next.
- These are intentionally valid vnode children, so you can use them to create simple reactive cells of sorts.
- `value` is the return value. In control vnodes, this is your vnode children.
- `done()` is called when the state reducer is being removed. It's not normally awaited, so be aware of that.
- Conveniently, this can be used as a control vnode, and it's special-made for it.

State reducer factories are just as simple: they take a value and return a state reducer. This might come as a surprise to you, but stateful components are implemented as exactly this: a state reducer factory that accepts attributes and returns a state reducer that emits views. If this helps, state reducer factories are just this: `(arg: Arg) => Reducer<Value, Ref>`. Stateful components are a close variant of that: `(arg: Attrs) => Reducer<Child, Ref>`. The full type of `Reducer` is this:

```ts
// Basic description
type Reducer<T, R = undefined> =
    <S>(context: Context<S>, state: S | undefined) =>
        {state: S, value: T, ref?: R, done?(): any};

// Exact, what'll go in Mithril's type definitions
type _MakeNullableOptional<T extends {}> =
	{[P in keyof T & {[K in keyof T]: void | null | undefined}]?: T[P]} & T;

type ReducerResult<T, R = undefined, S = any> = _MakeNullableOptional<{
	state: S, value: T, ref: R, done: (() => any) | void | null | undefined
}>;

type Reducer<T, R = undefined, S = any> =
    (context: Context<S>, state: S | undefined) => ReducerResult<T, R, S>;
```

This is purely a convention commonly used throughout the API. This is heavily inspired by React Hooks, but aims to keep the runtime overhead to a minimum. It also is not present in the core bundle because 99% of uses can generally just be written as a design pattern. And of course, there's a heavy FP inspiration here, but a pragmatic, impure one.

## Components

- Components: `component(attrs): view`
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
2. Updating can happen anywhere, and it doesn't matter where it is as long as the tree is updated appropriately. This brings a lot of added flexbility.
3. Components now only serve one master: abstraction. Control components serve the single master of enabling subtree updates.

If you've used [React Redux](https://react-redux.js.org/) and you squint hard enough, [you can see a mild resemblance to it](https://redux.js.org/basics/usage-with-react), yes, that was a partial inspiration. But this is also partially coincidence due to similar concerns:

- Incoming attributes are treated very similarly a Redux action dispatch.
- State is treated much like Redux component props.
- Unlike React Redux, this provides the previous state (their props) when receiving attributes (their action). This keeps the view logic within the component, which just makes more sense.
- Unlike React Redux, this fuses dispatch with rendering, so it avoids all the overhead of going through a full store and back.

I've used React Redux in a few boilerplates and seen several other React Redux projects, and yes, reducers are *very* commonly used as [state reducers in an MVI architecture](http://hannesdorfmann.com/android/mosby3-mvi-3). This is a partial inversion of that architecture, where:

- The view is fused with the "model"
- The view is specified together with its model
- The state reducer `receive` is receiving intents in the form of attributes

## Vnodes

- Element: `m("div", ...)`
	- `xmlns` sets the raw namespace to construct this with.
- Fragment: `m(Fragment, ...)`, `[...]`
- Keyed: `m(Keyed, ...)`
- Text: `m(Text, ...)`, `"..."`
- Raw: `m(Raw, {length = 1}, [...])`
	- Children may either be nodes (when rendering to DOM) or strings (when rendering to string).
	- This is retained as long as the children array remains the same.
	- If the node is a fragment, the fragment's length *is* tracked accordingly.
	- The underlying renderer decides what `elem` should be.
	- This replaces `m.trust` - you should instead do one of the following:
		- Set `innerHTML` directly. 99.999999% of the time, this is sufficient. It's worth noting React, as popular as it is, only lets you do this.
		- Create a factory node, set `innerHTML` into it, and copy its children into a fragment, and return the fragment in a raw vnode. (This is what Mithril v1 and v2 do internally.)
	- It's *highly* advised that you diff the attributes appropriately here.
    - This is partially to integrate better with certain third-party utilities that [return their own DOM nodes](https://fontawesome.com/how-to-use/with-the-api/setup/getting-started) for you to add.
- Retain: `m(Retain)`
	- This replaces `onbeforeupdate`.
	- If no subtree previously existed, this generates a raw node with the existing tree if hydrating or throws an error otherwise.
- Control: `m(Control, {ref: controlBody})`, `controlBody`
	- Control children: `controlBody(context, state): view | {state, ref?, done?, value: view}`
	- These are intentionally [state reducers](mvp-utils.md#state-combinator-api).
	- Returning `view` directly is equivalent to passing `{state, value: view, ref: undefined}`.
	- This is for when you need a fragment you can update manually.
	- This simplifies a few things.
	- This makes certain auto-binding patterns easier to specify.
	- This can provide some prop-like magic behavior without actually being a significant maintenance or boilerplate problem.
- Request element/ref access: `ref: (elem) => ...`, `ref: (value) => ...`, etc.
	- For component vnodes, `ref` is called with the `ref:` generated by the view.
	- For element and text vnodes: `ref` is called with the backing DOM node.
	- For raw vnodes: `ref` is called with the first DOM node + the raw length.
	- For retained and control vnodes: `ref` is not called.
	- For fragment vnodes, `ref` is called with an array of the above.
	- For keyed vnodes, `ref` is called with a key/value object of the above.
	- The callback is scheduled to run after rendering or in the next frame.
	- Return a callback to run on remove, ignored if the ref is replaced.
	- This replaces the `oncreate`/`onupdate`/`onbeforeremove`/`onremove` lifecycle methods.
	- There's a `Mithril.Ref.join`/`Mithril.Ref.all` utility for combining them better.

Notes:

- There are two special vnode attributes:
	- `key` - This tracks vnode identity and allows two functions:
		- In `Keyed` children, linking an instance to a particular identity. This is how keyed fragments work today.
		- In other cases, linking an instance to a particular state. This is how single-item keyed fragments work.
	- `ref` - This allows accessing the underlying DOM instance or provided component ref of a particular component or vnode.
- Vnode keys in `Keyed` are tracked like keyed fragments today
- Vnode keys in all other cases are diffed as part of the logical "tag name"
- Vnode keys are treated as object properties. Don't assume they're compared by literal identity, but treat them as if they're compared by property identity.
- Vnode children are stored in `attrs.children`
- There is no `vnode.text` - it's `children: "..."` for `trust`/`text` and `children: [m(text, "...")]` elsewhere
- An error would be thrown during normalization if a child is an object without a numeric `.mask` field.
- Refs are somewhat different from React's:
	- Refs are designed to be control mechanisms, not simply exposure mechanisms. They work more like a single-use token you can pass around and asynchronously query. Likewise, these are *not* saved in subsequent renders.
	- [React cares about ref identity](https://reactjs.org/docs/refs-and-the-dom.html#caveats-with-callback-refs), but this complicates the model a lot, especially when it's designed only for exposure.
- Technically, I could just do `Promise.resolve().then(callback)` and provide `vnode.dom` instead of `ref`, but there's five main reasons why I'm not:
	1. I wouldn't be able to convert errors within the callback to a more informative rejection.
	2. It's generally poor practice to try to mutate the DOM outside of event handlers (which provide it via `ev.target.value`) or a batched request. Forcing batching also keeps performance up and running.
	3. It makes it impossible to access an uninitialized element, simplifying types and avoiding potential for bugs.
	4. It slightly complicates access for simpler cases.

## Context

- Is serializing: `context.renderType()`
	- This is for cases like third party integration when you need to *not* invoke DOM-dependent libraries in server-side code.
	- This is used by `mithril/trust` to determine what to render.
	- This is returns `"html"` for `mithril/render-html` and `"dom"` for `mithril/render`
- Update state + view async: `context.update(next?).then(...)`
	- This schedules a subtree redraw for the relevant control vnode.
	- If `next` is passed, it's called with the current state and the state is replaced with its return value.
	- If a renderer only runs once, this is optional.
- Update state + view sync: `context.updateSync(next?)`
	- This is similar to `context.update(next?)`, but operates synchronously and either synchronously throws or synchronously returns `undefined`.
	- There exist legitimate use cases for sync redraws (mostly [DOM feedback](https://github.com/MithrilJS/mithril.js/issues/1166#issuecomment-234965960) and third-party integration), but semantics get hairy when sync redraws affect parent and sibling components. This is part of why sync redraws are restricted to subtree redraws. (The other main part is because it usually signals a broken abstraction.)

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

- `render(root, vnode?, {sync = false}).then(...)` - Render a tree to a root using an optional previous internal representation and return a promise resolved once it's fully committed to the DOM. This is exposed via `Mithril.render`.
	- `sync:` is a boolean option, but it does *not* result in a non-promise return value or synchronously thrown error. So this function is sometimes-sync in when side effects occur, but it *never* is sometimes-sync in error handling.
	- `hydrate:` means to hydrate an existing tree. If this option is truthy, an error is thrown if any differences exist between the existing DOM tree the incoming vnode tree.
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
	- This is just like `closure`, but sugars over attributes, too.

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

## General notes

- This separation keeps it a little more clearly tree-shakable and more cleanly abstracted.
- The global bundle is exported via a `m` global.
