[*Up*](./README.md)

# MVP Utilities

These are all various utilities that are, unless otherwise listed, kept out of the core bundle, but they are part of the MVP of this proposal.

## Path templates

This is exposed under `mithril/path` and in the full bundle via `Mithril.p`.

- `p(url, params = {})` - Interpolate `url` as a URL template with `params`.

Note that the [router](#router-api) and [request](#request-api) utilities no longer do their own path interpolation - users should use this instead. Also, note that this carries the semantics in [#2361](https://github.com/MithrilJS/mithril.js/pull/2361) in that `:x` always escapes and `:x...` never escapes.

### Why?

It's much easier and more predictable for both the library and users if path templates are resolved separately from APIs that accept paths. Also, users might want to use it with third-party apps.

## Router API

This is exposed under `mithril/router` and in the full bundle via `Mithril.Router`. The default export is a global router instance. It depends on the internal path parsing utilities, but that's it.

- `Router.global` - Get the global router.
	- `Router.global.prefix` - The global prefix to use.
		- When the prefix starts with `#`, routing is based on the URL's hash.
		- When the prefix starts with `?`, routing is based on the URL's query + hash.
		- When the prefix starts with anything else, routing is based on the full URL path, query, and hash.
		- The default prefix is `"#!"`.
		- When no DOM exists, the default history throws an error from every method.
	- `Router.global.set(href | setOpts).then(...)` - Set the current route.
		- `href`/`opts.href` - The target URL to move to. Specifying a string is equivalent to passing this without parameters.
		- `opts.replace` - Whether to replace the current history entry or append a new one.
		- `opts.state` - The state to associate with the history entry
		- `opts.title` - The title of the history entry
		- This is intentionally unwieldy. Prefer `Router.Link` where possible.
		- The returned promise awaits the route's rendering and all applicable redirects before it returns.
	- `Router.global.pop().then(...)` - Go back to the previous route.
		- The returned promise awaits the route's rendering and all applicable redirects before it returns.
	- When you pass a custom router, you need to implement the following methods:
		- `router.set({href, replace?, ...opts})` - Set the current history entry to `href` with router-specific `opts`, replacing it if `replace: true`.
		- `router.pop()` - Pop the most recent history entry.
		- `router.href` - Get the current entry's URL.
		- `router.state` - Get the current entry's state.
		- `router.resolve(url)` - Resolve a URL into one that could be used for external navigation. (optional, required only for `Router.Link`)
	- There are three special methods you shouldn't call, but exist to satisfy the above interface. You generally shouldn't call these unless you really need to
		- `Router.global.href` - Return the current URL relative to the prefix.
		- `Router.global.state` - Return the current history state
		- `Router.global.subscribe(() => ...)` - Invoke a callback on each update

- `Router.match({...routes, default, current?, router = Router.global})` - Dispatch based on a route.
	- `current = href | {href, state}` forces a current route, ignoring the history altogether. Passing a string is equivalent to passing `{path: current, state: null}`. Don't use this unless you're rendering server-side.
	- `default:` is the fallback route if no route is detected, if no routes match, or if the current route's `href` is literally `""`.
	- `"/route/:param": (params, match) => ...` - Define a route
		- `params` contains both query params and template params.
		- `match` is a child matcher, which carries the same prototype of `Router.match` minus `router` support. Note that 1. a child `current:` overrides the parent `current:` and 2. the raw relative prefix itself is not directly accessible. This need not be directly returned.
		- Invoke `match({href, ...opts})` or `match("/path")` to replace the current route to a particular sibling path. The first form is detected via the presence of an `href` parameter.
		- Invoke `match("next")` to skip to the next matching path
		- This can return either `match`/`Route.match` to skip or a value. The value need not be a vnode, but it can be.
		- This is exact by default, but the prefix carried by the context specifically *excludes* any final parameter, either `:param` or `:param...`.
	- When there is no active history (as in, when running without a global DOM and without an explicit `history:`), `current` is required.
	- If you want a 404 route, define a final route of `"/:path...": () => ...`.
	- Note: this returns a cell. So this *can* be used independently of Mithril's view.

- `m(Router.Link, {router = Router.global, ...opts}, elem)` - Create a link using the router's parent's implicit prefix
	- `children: [elem]` - An element to hook into with `onclick` + `href` (required)
	- `elem.attrs.href` - The target to route to.
	- `router:` - The global router instance to use.
	- All other component options, like `replace: true`, are passed straight to `router.push(opts)`

### Notes

- Prefer `Router.Link` over explicit `router.push(...)`/`router.replace(...)`/`router.pop(...)` for URLs. Mithril handles most of the boilerplate and
- Each of these strips the prefix as necessary, and they wrap inconsistencies in the history passed to `Router.create(...)`.
- `Router.Link` requires `m` from `mithril/m`, but this is otherwise fully zero-dependency, so you *could* use this in both cells and the virtual DOM tree without issue.
- You can have multiple separate `Router.match` instances active at once. So for example, you could use one in your navigation to select which item is considered "active" *and* one in the main page to select which page body to render. As mentioned above, it returns a cell that passes through its output, so you can still use it in other contexts like your data model.
- This is necessarily somewhat larger than the current v2 router, because of the dynamic route matching.

Also, `Router.Link` should be changed to work like this, for better accessibility and compatibility:

```js
Router.Link = attrs => Cell.map(attrs, ({
	router = Router.global,
	children: [{tag, attrs: {onclick, href, ...attrs}}],
	...opts
}) => ({tag, attrs: {
	...attrs,
	href: router.resolve(href),
	onclick(ev) {
		let canChangeRoute = true

		if (typeof onclick === "function") {
			canChangeRoute = onclick.call(this, ev) !== false
		} else if (onclick != null && typeof onclick === "object") {
			onclick.handleEvent(ev)
		}

		if (
			// Skip if `onclick` prevented default
			canChangeRoute && !ev.defaultPrevented &&
			// Ignore everything but left clicks
			(ev.button === 0 || ev.which === 0 || ev.which === 1) &&
			// Let the browser handle `target="_blank"`, etc.
			(!this.target || this.target === "_self") &&
			// No modifier keys
			!ev.ctrlKey && !ev.metaKey && !ev.shiftKey && !ev.altKey
		) Router.push({href, ...opts})

		return false
	},
}}))
```

### Why?

Well, the need for routing is obvious, but there are a few key differences I'd like to explain.

- Routing is partially dynamic. Because you can invoke `match` at any point, you can load routes asynchronously and just invoke `match` lazily after the child is loaded. This is useful for async routes and lazy loading of common child layouts in larger apps.
- Routing returns a valid vnode. This means you can define a layout and on `render(dom, m(Layout, {...}))`, you can define in your children a simple route. On route change, your layout ends up preserved and *not* redrawn, while your page *is*.
- Routing returns a valid cell that doesn't itself to be mounted to the DOM, and it supports multiple entry points. This means you can use it not only in your views, but also in your model when certain state is route-dependent.
- Each of the various route setting methods return promises. That way, you get notified when the route change completes.

## Request API

This is exposed under `mithril/request` and in the full bundle as `Mithril.request`.

- JSONP support is gone. It's basically obsolete now in light of CORS being available on all supported platforms, and our code is easy to just copy if necessary.
- Interpolation support is removed. Use [`p(url, params)`](#path-templates) instead.
- Abort signals can be provided via a `signal:` parameter for compatibility with `fetch`. Note that anything with an `onabort` property can work for this, not just an abort controller.
	- This replaces `xhr.abort()` in the `config:` callback. Don't call that directly - pass `controller.signal` and invoke `controller.abort()` on the corresponding controller instead.
	- Note: for convenience

Beyond that, the API is probably fine as-is after [#2335](https://github.com/MithrilJS/mithril.js/pull/2335) and [#2361](https://github.com/MithrilJS/mithril.js/pull/2361) are merged.

## Transition API

This is exposed under `mithril/transition` and in the full bundle via `Mithril.Transition`.

- `m(Transition, {in, out, show, onin, onout}, children)` - Define a transitioned element
	- `in:` - Zero or more space-separated classes to toggle while transitioning inward.
	- `out:` - Zero or more space-separated classes to toggle while transitioning outward.
	- `show:` - Whether this should be considered shown.
	- `onin:` - Called after the transition for `in:` completes, if `in:` is present.
	- `onout:` - Called after the transition for `out:` completes, if `out:` is present.
	- `children:` - The element to transition with. Note: this *must* be a single element.

Notes:

- `onfinish` is only called for `in`/`out` finish when the relevant property exists and is `!= null`.
- Transitioned elements are cloned with appropriate attributes added and event handlers wrapped.
- When an element is hidden and immediately re-shown, the removal animation is awaited and the element fully removed before it's re-added.
- When an element is removed and immediately re-added and removed again, the removal animation is *not* restarted, nor is it re-added.

### Why?

1. Transitions are common enough they should have a story.

## HTML renderer

This is exposed under `mithril/render-html`.

Basically `mithril-node-render`, moved into core. Optionally, I might also expose a streaming interface so it can be incrementally written to the stream as it becomes ready for it, for very streamlined server-side rendering support.

### Why?

1. It's a very common renderer that has to know a lot about Mithril's internals to begin with.
1. It shares a lot in common with hydration, so they both need to be at least somewhat aware of each others' existence.
1. It lets us keep API changes much more tightly integrated.
1. It helps us determine more easily what's common between single-shot and retained renderers, so we can know what abstractions to expose.
1. It makes our SSR support much more discoverable.
1. It's a much simpler upgrading story.

## Streams

This will be maintained initially under `mithril-stream` for a short time (with `mithril/stream` throwing an error telling people to migrate), but it's deprecated in favor of cells, which offer a lot more functionality out of the box and are just all around easier to define, easier to use. They're smaller when compressed, too, so that's even more reason to switch to cells.

## Cell utilities

This is exposed under `mithril/cell` and in the full bundle via `Mithril.Cell`.

- `cell = Cell.all([...cells], ([...values]) => ...)` - Join multiple cells in an array into a single cell with each named by index
	- The resulting cell emits arrays for its children.
	- If the callback is omitted, it defaults to the identity function.
	- Received `next` calls from cells are resolved synchronously and emit synchronously if all values have been assigned.

- `cell = Cell.join({...cells}, ({...values}) => ...)` - Join multiple cells in an object into a single cell with each named by property
	- The resulting cell emits objects for its children.
	- If the callback is omitted, it defaults to the identity function.
	- Received `next` calls from cells are resolved synchronously and emit synchronously if all values have been assigned.

- `result = Cell.run(value, ...funcs)` - Run a value through a series of functions.
	- Basically sugar for `funcs.reduce((x, f) => f(x), value)`
	- Once JS has a [pipeline operator](https://github.com/tc39/proposal-pipeline-operator/), this becomes less necessary.
	- This is useful for creating a pipeline of cell transforms.

- `cell = Cell.map(oldCell, (value) => newValue)` - Transform a cell's return value.

- `cell = Cell.filter(oldCell, (value) => boolean)` - Filter a list of values based on a condition

- `cell = Cell.scan(oldCell, initial, (acc, value) => newValue)` - Return a new value based on the old value + an accumulator.

- `cell = Cell.scanMap(oldCell, initial, (acc, value) => [newAcc, newValue])` - Much like a combined `map` and `scan`, where it accumulates *and* transforms a value.
	- This is useful for when it's easiest to operate using a reducer.
	- This is technically sugar for `Cell.map(Cell.scan(oldCell, [initial], ([acc], value) => func(acc, value)), ([, value]) => value)`, but it's much better optimized internally.

- `cell = Cell.reduce(oldCell, initial, (acc, value) => newValue)` - Fold all values from a cell into a result, and return a cell that emits only that one value.

- `cell = Cell.distinct(oldCell, compare?)` - Filter distinct (unchanged from previous) values from a cell.
	- `compare(prev, value)`- Called to check if a value is the same. Defaults to `(a, b) => a === b || Number.isNaN(a) && Number.isNaN(b)`
	- Ordinarily, this wouldn't justify itself in the MVP, but it makes for a very easy `onbeforeupdate` replacement.

- `cell = Cell.tap(cell, (value) => newValue)` - Return a cell that runs a cell and invokes a function on each emitted value.

- `cell = Cell.of(...values)` - Create a cell that emits only a series of constants.

- `cell = Cell.merge(...cells)` - Create a cell that emits when one of a variety of cells merge.
	- This initializes each cell argument using the exact arguments passed to the main returned cell itself. So if it's invoked as a control vnode, each child cell is also invoked as one. This is useful when the cell can specialize based on whether it's a control vnode, a normal cell, or something else it's aware of.

- `Cell.NEVER` - A cell that never emits.

- `cell = Cell.chain(oldCell, (value) => newCell)` - Take a cell's value and pipe its value through a new function and return a new cell wrapping its return value.
	- You might recognize this function shape and maybe even its name. Yes, it's a flat-map/monadic bind.
	- Note: this initializes returned child cells using the exact arguments passed to the main returned cell itself. So if it's invoked as a control vnode, the returned child cell is also invoked as one. This is useful when the cell can specialize based on whether it's a control vnode, a normal cell, or something else it's aware of.
	- Note: this closes previously created cells before initializing the next one. If that's not what you intend, create a custom cell that delegates to this.

- `cell = Cell.onDone(oldCell, done)` - Return a cell that invokes a `done` callback on completion.
	- Note: this initializes `oldCell` using the exact arguments passed to the main returned cell itself. So if it's invoked as a control vnode, `oldCell` is also invoked as one. This is useful when the cell can specialize based on whether it's a control vnode, a normal cell, or something else it's aware of.

- `Cell.shallowEqual(a, b)` - Shallow-compare two objects or arrays, optionally using a comparison function.
	- This compares values as per the ES operation SameValueZero(`a`, `b`), which is mostly like `a === b` except NaNs are considered equal. (This is what maps and sets use.)
	- This considers two objects equal if the set of keys are equal (ignoring order) and their associated values are equal.
	- This considers two arrays equal if they are of the same length and their values are equal.
	- This considers one object and one array as not equal, even if all their properties match.
	- An error is thrown if either parameter is *not* an object.
	- This is particularly useful with `Cell.distinct` - you can just do `Cell.distinct(attrs, Cell.shallowEqual)` and have automatically diffed attributes for the most common case. This is about the only reason it's in the core `mithril/cell` module, and not completely out of core.

This is implemented [here](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/cell.mjs), with an optimized implementation [here](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/optimized/cell.mjs). This is actually *smaller* than streams, despite providing better, more powerful functionality.

Notes:

- Each of these are written to be resilient against synchronous updates.
- None of these have any dependencies on anything other than just the language itself. This means you can freely use this anywhere for all its benefits, without fear.

### Why?

A few reasons:

- You often want to manipulate cells to new values, but doing it all manually is *very* tedious.
- Components can be functions from a cell of attributes to a vnode tree, so lifecycle hook naturally fall from the model.
- This is what would be our answer to React Hooks, just substantially lower in overhead.
- Most streaming utilities can directly translate to this.

Also, there's a handful of helpers [here](https://github.com/isiahmeadows/mithril.js/tree/v3-redesign/helpers) based on [some of these hooks](https://usehooks.com/), in case you want to know what it could look like in practice.

This utility is slightly smaller than Mithril's existing streams utility when minified and gzipped. Also, the names compress a bit better when bundled with other things, especially if you use Rollup, and it ends up comparable in source size *to* code using hooks exclusively, if not sometimes substantially smaller.

## Hook cells

This is exposed under `mithril/hooks` and in the full bundle under the namespace `Mithril.Hooks`. It's modeled after [React's Hooks API](https://reactjs.org/docs/hooks-reference.html), but with a few pragmatic differences with an aim for simplicity. It's *not* exposed in the core or full bundles, since it's aimed towards more advanced use cases.

- `resultCell = initHooks(() => result)` - Initialize a standalone hook cell with no input, only state.

- `resultCell = initHooks(paramCell, (param) => result)` - Initialize a hook cell updated with each value emitted from `paramCell`.

- `Component = withHooks(body)` - Wrap a component to return a hook cell
	- This is just simple sugar for `(attrs) => initHooks(attrs, body)`
	- Mithril doesn't support hooks by default, so this is how you create a component that comprehends hooks.

- `[state, setState] = useState(init, reducer = (_, x) => x)` - Define a state field
	- `init` is the initial value
	- `state` is the current value
	- `setState(nextState)` sets the current value to a new value.
	- `[state, setState] = useStateInit(init, reducer?)` - Generate the initial value with a thunk.

- `[state, dispatch] = useState(init, (state, value) => newState)` - Define a reducer field
	- `init` is the initial value
	- `state` is the current value
	- `dispatch(value)` cycles the reducer with a new value. The reducer is run synchronously for performance reasons.
	- `[state, dispatch] = useStateInit(init, reducer)` - Generate the initial value with a thunk.

- `ref = useRef(init)` - Define a reference with a `.current` property and return it
	- Note: you can't pass this directly to `ref` - you have to do `ref: elem => ref.current = elem` instead.
	- `ref = useRefInit(reducer, init)` - Generate the initial value with a thunk.

- `useEffect([...deps], onUpdate)` - Schedule an effect callback
	- Invokes `onUpdate([...deps])` whenever any of `deps` changes, after the hook returns.
	- You can return a callback run when either the cell is closed or if the deps change.

- `value = useMemo([...deps], value)` - Save and return `value` any of `deps` changes, or return the previously saved value otherwise.
	- `value = useMemoInit([...deps], init)` - Pass and save `init([...deps])` instead.

- `throw IGNORE` - Invoke this to ignore the return value. Do not use this in a custom hook unless you *really* mean for it to operate as some control flow operator. Note that it *does* throw an exception, one that's meant to be , so don't use this except at the end of the main hook cell body.

- `[current, send] = useCellFactory(cellFactory)` - Use a cell transformer that accepts a cell of parameters and returns a cell of values.

- `current = useCell(cell)` - Use a cell and return the most recent state.
	- This is technically sugar for `[current] = useTransformer(() => cell)`, but it's something optimized for internally.

- `isControl()` - Whether this hook was called with a context (as in, it was called as a control vnode).

- `value = useRenderInfo(key)` - Return `context.renderInfo[key]`
	- This is for things like if you need to render server-side only or similar.
	- Note: this assumes the hook was called with a context.

- `value = useContext()` - Return `context`
	- This is for things like if you need to render server-side only or similar.
	- This returns `undefined` if the hook cell was called without a context.
	- Note: if you're using this for anything beyond `if (useContext() != null) ...`, you're *probably* doing something wrong.

Notes:

- The result of `initHooks(params, body)` and `initHooks(body)` can be used as either a cell or a context vnode, and if the cell receives a [`context` parameter](core.md#context), it will use `context.scheduleLayout(...)` rather than `Promise.resolve().then(...)` to schedule effects and state updates.
- Updates are run in the callback of `context.scheduleLayout(callback, cancel?)` if the returned cell is used as a control vnode, and in the next microtask otherwise.
- `useEffect`, `setState`, and similar all schedule an update immediately when it runs.
- When comparing dependencies, they're compared via the ES operation SameValueZero(`a`, `b`), which is mostly like `a === b` except NaNs are considered equal. (This is what maps and sets use.)
- When an update run involves updating internal state, the hook body is invoked again.
- The general flow for each update run is this:
	1. Perform all scheduled tasks
	2. Invoke the hook body and return its result
- This intentionally doesn't provide support for `context.renderSync(view)`

This is implemented [here](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/cell.mjs), with an optimized implementation [here](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/optimized/cell.mjs). Incidentally, the optimized standalone version is only nominally larger than the unoptimized one - both are about 1.1KB. Contrast this with v1/v2 streams, which are just under 1.0KB (it rounds up to it).

### Why diverge from React?

There's reasons for each:

1. It's *very* easy to accidentally use `useState(SomeComponent)` when you really intended to use `useState(() => SomeComponent)`. Also, functions are a *lot* more common in the face of cells.
1. I merge the concepts of an initial value and initializer function in `useReducerInit` because it's kind of redundant.
1. `deps` lists should *never* be optional - every function has dependencies of some kind. And when no dependencies are listed, the most obvious default, at least to me, is to just assume it has no dependencies. Incredibly stale data will show itself as a bug eventually, so I don't see the need to try to protect people from themselves.
1. Some hooks don't make sense with this redesign, so I've left them out:
	- `useContext` - Mithril doesn't have React-like context, and this redesign doesn't change this.
	- `useImperativeHandle` - Refs are component-specific, and this redesign has people instead explicitly call `attrs.ref(value)` as applicable.
	- `useLayoutEffect` - Our `useEffect` is React's `useLayoutEffect`. I'm not delaying all the way to an animation frame *just* to force some level of asynchrony, and it doesn't make sense when it's being used just as a normal cell.
	- `useDebugValue` - Mithril doesn't expose this functionality in the first place, so I'm leaving this one out until it proves truly necessary.
1. Hooks are fundamentally about data manipulation, not generating trees. I leverage this to make it work in places other than components by having it integrate with cells instead.
1. And of course,

### Why?

Cells are great at abstracting operations, but hooks are great for unnesting their data and integrating that all together. This is made to give you the best of both worlds, so you can freely create some *very* powerful abstractions and components.

And integration *is* fairly easy: `initHooks(() => ...)` returns a cell, and `useCell`/`useCellFactory` consumes cells. So you can even use a router as a hook via `useCell(Router.match({...}))` if you really wanted to.
