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
	- If no subtree previously existed, this throws an error.
- Portal get: `m(PortalGet, {token, default}, value => children)`
- Portal set: `m(PortalSet, {token, value}, children)`
- Request element/ref access: `ref: (elem, length) => ...` for elements/fragments/etc., `ref: value => ...` otherwise
	- For fragments, `elem` is the first element child and `length` is the number of elements in the ref.
		- For element vnodes: `elem` is the backing DOM vnode.
		- For fragment vnodes: `elem` is the first child.
		- For keyed vnodes: `m(Keyed, ...)`
		- For text vnodes: `m(text, ...)`, `"..."`
		- For raw vnodes: `m(raw, {elem: Node | string, length = 1, key?})`
	- This is not called on retained vnodes.
	- The callback is called with the element and fragment size
	- The callback is scheduled to run after rendering or in the next frame.
	- Return a callback to run on remove, ignored if the ref is replaced.
		- Promises returned from remove callbacks block removal of all the linked refs' elements.
	- This replaces the `oncreate`/`onupdate`/`onbeforeremove`/`onremove` lifecycle methods.
	- There's a `m.ref.join`/`m.ref.all` utility for combining them better.

Notes:

- Portals are indexed by token, but the token can be any type. Note that `NaN` should *not* be used as the algorithm just uses `lastIndexOf` and an internal stack for portal tokens.
- You can specify an array of portals + an array of values/defaults to get them all at once and sent through the callback as an array, instead of just a single portal or default.
- There are two special vnode attributes:
	- `key` - This tracks vnode identity and allows two functions:
		- In `Keyed` children, linking an instance to a particular identity. This is how keyed fragments work today.
		- In other cases, linking an instance to a particular state. This is how single-item keyed fragments work.
	- `ref` - This allows accessing the underlying DOM instance or provided component ref of a particular component or vnode.
- Vnode keys in `Keyed` are tracked like keyed fragments today
- Vnode keys in all other cases are diffed as part of the logical "tag name"
- Vnode children are stored in `attrs.children`
- There is no `vnode.text` - it's `children: "..."` for `trust`/`text` and `children: [m(text, "...")]` elsewhere

Notes:

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
	- This is for `m.trust`, but exists for general use, too.
	- This is set to `true` by userland `mithril/render-html` and `false` by core `mithril/render`
- Update state + view async: `context.update(next?).then(...)`
	- This schedules a global redraw.
	- If `next` is passed, the state is replaced with it.
	- `opts.global` schedules a global redraw rather than a local one.
	- If a renderer only runs once, this is optional.
- Update state + view sync: `context.updateSync(next?, opts = {}).then(...)`
	- This is similar to `context.update(next?, opts = {})`, but operates synchronously.
	- There exist legitimate use cases for sync redraws (mostly [DOM feedback](https://github.com/MithrilJS/mithril.js/issues/1166#issuecomment-234965960) and third-party integration), but semantics get hairy when sync redraws affect parent and sibling components. This is part of why sync redraws are restricted to subtree redraws. (The other main part is because it usually signals a broken abstraction.)
- Global update: `context.globalUpdate(next?).then(...)`, `context.globalUpdateSync(next?).then(...)`
	- `context.globalUpdate(next?).then(...)` - Update state + view async
	- `context.globalUpdateSync(next?).then(...)` - Update state + view sync
	- This is similar to the non-subtree variants, but .
	- This schedules a subtree redraw, not a root-level redraw.
	- Sync redraws are only available for subtrees, and it can only be done while not rendering the component body.
	- Note that even though `subtree.redrawSync()` starts synchronously, DOM removals *could* be blocked by `onremove` hooks, so it still returns a promise in this case. And as expected, errors during the redraw are converted into rejections and not rethrown.
	- There exist legitimate use cases for sync redraws (mostly [DOM feedback](https://github.com/MithrilJS/mithril.js/issues/1166#issuecomment-234965960) and third-party integration), but semantics get hairy when sync redraws affect parent and sibling components, thus why sync redraws are restricted to subtree redraws.
	- Async = batched, sync = started immediately

## Core API

- `mithril/m` - The hyperscript API
	- `m`/`default` - The hyperscript factory
	- `Fragment`, `Keyed`, `Text`, `Trust`, `Retain` - Built-in components
	- `create(mask, tag, attrs, children)` - The vnode factory
	- `normalize` - The vnode factory
	- Other stuff from `render/vnode.js` gets dropped into here, too.
	- Added bonus: it's easier to port to Rollup later on.
- `mithril/render` - The DOM renderer API
	- Depends on `mithril/m`
	- `createRender = createRenderFactory(schedule: (callback?) => any, document)` - Create a render function with a scheduler and a window reference.
		- This is not exposed except through the module itself. The public API exposes a `m.render = createRenderFactory(rAFWrapper, document)`
		- The `schedule` parameter is just a simple scheduler callback called on update to request a time slot. `render` handles redraw batching internally, so `schedule` just needs to schedule.
		- The `schedule` parameter is called during auto-redraw scenarios and during `context.update`.
		- The callback mechanism here is abstracted to keep all the per-root batching in `render`, so it's easier to deduplicate requests.
		- The DOM methods and properties used will be eventually documented, but additions to that list wouldn't be considered semver-major. (I'd see about making them semver-minor, so )
	- `render = createRender(root, ir?)` - Create a renderer from a root and optional existing internal representation.
	- `render(vnode?).then(...)` - Render a view and return a promise resolved once it's fully committed to the DOM.
		- The first render is guaranteed synchronous as no async initialization is permitted.
		- Note that no `.vnodes` or similar magic property exists. You *have* to retain a reference to update it with a diff.
	- First renders are always synchronous. Subsequent renders await async unmounting before rendering subtrees. (This avoids certain async complications.)
- `mithril/register` - The DOM internal redraw API
	- Depends on `mithril/render`
	- `mountpoint = register(root, () => vnode)` - Create a mountpoint, but skip initial render
		- `mountpoint.update().then(...)` - Works similarly to `context.update()`
		- `mountpoint.updateSync().then(...)` - Works similarly to `subtree.updateSync()`
		- `mountpoint.unmount()` - Unmount the view from the root and dispose
		- Internally, this calls `render(root, view(), internalRedraw)`
- `mithril/mount` - The DOM mounting API
	- Depends on `mithril/register` and `mithril/render`
	- `mountpoint = mount(root, () => vnode)` - Mount a view function
- `mithril/hydrate` - The DOM hydration API
	- Depends on `mithril/m` and `mithril/register`
	- `mountpoint = hydrate(root, () => vnode)` - Hydrate a view
- This separation keeps it a little more clearly tree-shakable.
- The global bundle is exported via `Mithril`
