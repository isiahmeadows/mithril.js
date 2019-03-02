[*Up*](./README.md)

# Core

Core would change considerably, but this is to simplify the API and better accommodate components.

- Changes to vnodes and primitives
	- Changes to the vnode structure
	- Primitive components
	- Userland components
	- Separation of keyed and unkeyed fragments
	- Normalization changes
- Changes to components
	- TODO

## Goals

- Libraries should be largely independent of where it gets its Mithril state. This is why `context` is passed as a parameter to components.
- It should be as concise as pragmatically possible, yet still remain actual JS. This guided my decision to offer both reducer and closure variants.

## Component variants:

- Closure: `component(attrs, context) => (attrs) => (view | {view, ref?})`
- Reducer: `component(attrs, context, state?) => view | {next, view, ref?}`
	- Omitting `next` is equivalent to passing `{next: state}`, not `{next: undefined}`.
- `ref` is for if you want to support a custom `ref`.
- If you want previous attributes and/or state, store the old values in the new state. Mithril does *not* retain them.
- Note: `attrs` is really `{...vnode.attrs, children: vnode.children}` from the vnode.

## Vnodes

- Element: `m("div", ...)`
- Fragment: `m(Fragment, ...)`, `[...]`
- Keyed: `m(Keyed, ...)`
- Text: `m(Text, ...)`, `"..."`
- Raw: `m(Raw, Node | string)`
	- This is retained as long as `elem` remains the same.
	- If the node is a fragment, the fragment's length *is* tracked accordingly.
	- The underlying renderer decides what `elem` should be.
	- This replaces `m.trust` - you should instead do one of the following:
		- Set `innerHTML` directly. 99.999999% of the time, this is sufficient. It's worth noting React, as popular as it is, only lets you do this.
		- Create a factory node, set `innerHTML` into it, and copy its children into a fragment, and return the fragment in a raw vnode.
	- It's *highly* advised that you diff the attributes appropriately here.
    - This is partially to integrate better with certain third-party utilities that [return their own DOM nodes](https://fontawesome.com/how-to-use/with-the-api/setup/getting-started) for you to add.
- Retain: `m(Retain)`
	- This replaces `onbeforeupdate`.
	- If no subtree previously existed, this generates a raw node with the existing tree if hydrating or throws an error otherwise.
- Request element/ref access: `ref: (elem, length) => ...` for elements/fragments/etc., `ref: value => ...` otherwise
	- For component vnodes, `ref` is called with the `ref:` returned with the view.
	- For element and text vnodes: `ref` is called with the backing DOM node.
	- For raw vnodes: `ref` is called with the first DOM node + the raw length.
	- For retained vnodes: `ref` is not called.
	- For all other vnode typs, `ref` is called with zero arguments.
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

- Is serializing: `context.isSerializing`
	- This is for cases like third party integration when you need to *not* invoke DOM-dependent libraries in server-side code.
	- This is set to `true` by `mithril/render-html` and `false` by `mithril/render`
- Update state + view async: `context.update(next?).then(...)`
	- This schedules a global redraw.
	- If `next` is passed, it's called with the current state and the state is replaced with its return value.
	- If a renderer only runs once, this is optional.
- Update state + view sync: `context.updateSync(next?).then(...)`
	- This is similar to `context.update(next?)`, but operates synchronously.
	- There exist legitimate use cases for sync redraws (mostly [DOM feedback](https://github.com/MithrilJS/mithril.js/issues/1166#issuecomment-234965960) and third-party integration), but semantics get hairy when sync redraws affect parent and sibling components. This is part of why sync redraws are restricted to subtree redraws. (The other main part is because it usually signals a broken abstraction.)
- Set state + view async: `context.set(next).then(...)`
	- Sugar for `context.update(() => next)`
- Set state + view sync: `context.setSync(next?).then(...)`
	- Sugar for `context.updateSync(() => next)`

## Hyperscript API

This is the existing hyperscript API, exposed via exports of `mithril/m`. Each of these are exposed from the browser bundle with properties of the same name.

- `m`/`default` - The hyperscript factory
- `Fragment`, `Keyed`, `Text`, `Trust`, `Retain` - Built-in components
- `create(mask, tag, attrs, children, key, ref)` - The vnode factory
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

The DOM hydration API is exposed under `mithril/hydrate` and is exposed under `Mithril.hydrate`. It depends on `mithril/render` and `mithril/m`.

- `hydrate(root, vnode?)` - Renders a root vnode.
	- This assigns an expando `._ir` to the root if one doesn't exist already.

Notes:

- An error is thrown if `root._ir` already exists.
- An error is thrown if any differences exist between the existing DOM tree the incoming vnode tree.
- If an error is thrown at any point, all successfully added removal hooks are called immediately before throwing the caught error. If any of these throw, their errors replace the initially caught error and are rethrown instead.
- This shares a lot of internal subscription code with `mithril/render`, so those need to share a common backend.

## General notes

- This separation keeps it a little more clearly tree-shakable and more cleanly abstracted.
- The global bundle is exported via a `m` global.
