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

Notes:

- Goals:
	- Libraries should be largely independent of where it gets its Mithril state. This is why `context` is passed as a parameter to components.
	- It should be as concise as pragmatically possible, yet still remain actual JS. This guided my decision to offer both reducer and closure variants.

- Component variants:
	- Closure: `component(attrs, context) => (attrs => view) | {view(attrs): view, ref?}`
	- Reducer: `component(attrs, context, state?) => view | {next, view, ref?}`
		- Omitting `next` is equivalent to passing `{next: state}`, not `{next: undefined}`.
		- `ref` is for if you want to support a custom `ref`.
		- `onremove: () => void | Promise<void>` lets you run a callback, finished on ref.
	- If you want previous attributes or state, store the old state/attribute values in the new state. Mithril does *not* retain them.
	- Note: `attrs` is really `{...vnode.attrs, children: vnode.children}` from the vnode.

- Vnodes:
	- Raw: `m("div", ...)`
	- Fragment: `m(fragment, ...)`, `[...]`
	- Keyed: `m(keyed, ...)`
	- Text: `m(text, ...)`, `"..."`
	- Trusted: `m(trust, ...)`
	- Retain: `m(retain)`
		- This replaces `onbeforeupdate`.
		- If no subtree previously existed, this throws an error.
	- Vnode keys in `keyed` are tracked like today
	- Vnode keys in all other cases are diffed as part of the logical "tag name"
	- Vnode children are stored in `attrs.children`
	- There is no `vnode.text` - it's `children: "..."` for `trust`/`text` and `children: [m(text, "...")]` elsewhere
	- Request element/ref access: `ref: ref`

- Context:
	- Is initial: `context.isInit`
	- Update state + view: `context.update(next?).then(...)`
		- This schedules a root-level redraw.
		- If `next` is passed, the state is replaced with it.
		- You can do `subtree.redraw(next?)` to do an async subtree redraw.
	- Subtree context: `subtree = context.subtree()`
		- `subtree.update(next?).then(...)` - Update state + view async
		- `subtree.updateSync(next?).then(...)` - Update state + view sync
		- If `next` is passed, the state is replaced with it.
		- This schedules a subtree redraw, not a root-level redraw.
		- The separate binding is required because it needs to necessarily capture a reference to the instance's path for internal bookkeeping (specifically for certain optimizations).
		- Sync redraws are only available for subtrees, and it can only be done while not rendering the component body.
		- Note that even though `subtree.redrawSync()` starts synchronously, DOM removals *could* be blocked by `onremove` hooks, so it still returns a promise in this case. And as expected, errors during the redraw are converted into rejections and not rethrown.
		- There exist legitimate use cases for sync redraws (mostly [DOM feedback](https://github.com/MithrilJS/mithril.js/issues/1166#issuecomment-234965960) and third-party integration), but semantics get hairy when sync redraws affect parent and sibling components, thus why sync redraws are restricted to subtree redraws.
		- Async = batched, sync = started immediately
	- Refs:
		- Create ref: `ref = context.ref()`, `ref = context.ref({...refs})`, `ref = context.ref([...refs])`
		- Update ref: `ref.update((elem, len) => ...)`, `ref.update(customRef => ...)`, `ref.update(({...elems}) => ...)`, `ref.update(([...elems]) => ...)`
		- The callback is called with the element and fragment size
		- The callback is scheduled to run after rendering or in the next frame.
		- Return a callback to run on remove, ignored if the ref is replaced.
			- Promises returned from remove callbacks block removal of all the linked refs' elements.
		- This replaces the `oncreate`/`onupdate`/`onbeforeremove`/`onremove` lifecycle methods.
	- Refs are somewhat different from React's:
		- Refs are designed to be control mechanisms, not simply exposure mechanisms. They work more like a single-use token you can pass around and asynchronously query. Likewise, these are *not* saved in subsequent renders.
		- [React cares about ref identity](https://reactjs.org/docs/refs-and-the-dom.html#caveats-with-callback-refs), but this complicates the model a lot, especially when it's designed only for exposure.
	- Technically, I could just do `Promise.resolve().then(callback)` and provide `vnode.dom`, but there's four main reasons why I'm not:
		1. I wouldn't be able to convert errors within the callback as a more informative rejection.
		2. It's generally poor practice to try to mutate the DOM outside of event handlers (which provide it via `ev.target.value`) or a batched request. Forcing batching also keeps performance up and running.
		3. It makes it impossible to access an uninitialized element, simplifying types and avoiding potential for bugs.
		4. It slightly complicates access for simpler cases.

- Core API:
	- `mithril/m` - The hyperscript API
		- `m`/`default` - The hyperscript factory
		- `fragment`, `keyed`, `text`, `trust`, `retain` - Built-in components
		- `create` - The vnode factory
		- Other stuff from `render/vnode.js` gets dropped into here, too.
		- Added bonus: it's easier to port to Rollup later on.
	- `mithril/render` - The DOM renderer API
		- Depends on `mithril/m`
		- `render(root, vnode, schedule?: cb => newCb? => void}).then(...)` - Render a view
			- The `redraw` parameter is called during auto-redraw scenarios and during `context.redraw`/`context.update`.
			- The callback mechanism here is abstracted to keep all the per-root batching in `render`, so it's easier to deduplicate requests.
	- `mithril/register` - The DOM internal redraw API
		- `mountpoint = register(root, () => vnode)` - Create a mountpoint, but skip initial render
			- `mountpoint.update()` - Works similarly to `context.update()`
			- `mountpoint.updateSync()` - Works similarly to `subtree.updateSync()`
			- `mountpoint.unmount()` - Unmount the view from the root and dispose
			- Internally, this calls `render(root, view(), internalRedraw)`
	- `mithril/mount` - The DOM mounting API
		- Depends on `mithril/register` and `mithril/render`
		- `mountpoint = mount(root, () => vnode)` - Mount a view function
	- `mithril/hydrate` - The DOM hydration API
		- Depends on `mithril/m`, `mithril/register`, and (potentially) `mithril/render`
		- `mountpoint = hydrate(root, () => vnode)` - Hydrate a view
	- This separation keeps it a little more clearly tree-shakable.
	- The global bundle is exported via `Mithril`
