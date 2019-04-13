[*Up*](./README.md)

# MVP Utilities

These are all various utilities that are, unless otherwise listed, kept out of the core bundle, but they are part of the MVP of this proposal.

## Path templates

This is exposed under `mithril/path` and in the full bundle via `Mithril.p`.

- `p(url, params = {})` - Interpolate `url` as a URL template with `params`.

Note that the [router](#router-api) and [request](#request-api) utilities no longer do their own path interpolation - users should use this instead. Also, note that this carries the semantics in [#2361](https://github.com/MithrilJS/mithril.js/pull/2361) in that `:x` always escapes and `:x...` never escapes.

Also, when appending query parameters, indices are *not* added - it's always generated as `foo[]=a&foo[]=b` for `foo: ["a", "b"]`, not `foo[0]=a&foo[1]=b` as what's currently done. This plays better with most servers, since more accept the first form than the second and the vast majority that accept the second also accept the first.

### Why?

It's much easier and more predictable for both the library and users if path templates are resolved separately from APIs that accept paths. Also, users might want to use it with third-party apps.

### What about `m.buildQueryString` and `m.parseQueryString`?

Those would still be available via `mithril/querystring`, but not from the core or full bundle.

## Router API

This is exposed under `mithril/router` and in the full bundle via `Mithril.Router`. The default export is a global router instance. It depends on the internal path parsing utilities, but that's it.

- `Router.global` - Get the global router.
	- `Router.global.prefix` - The global prefix to use.
		- When the prefix starts with `#`, routing is based on the URL's hash.
		- When the prefix starts with `?`, routing is based on the URL's query + hash.
		- When the prefix starts with anything else, routing is based on the full URL path, query, and hash.
		- The default prefix is `"#!"`.
	- `Router.global.set(href, opts).then(...)` - Set the current route.
		- `href` - The target URL to move to. Specifying a string is equivalent to passing this without parameters.
		- `opts.replace` - Whether to replace the current history entry or append a new one.
		- `opts.state` - The state to associate with the history entry.
		- `opts.title` - The title of the history entry. Currently, out of all major browsers, this only affects the UI in Firefox, but it exists in case people want to use it.
		- This is intentionally unwieldy. Prefer `Router.Link` where possible.
		- The returned promise awaits the route's rendering and all applicable redirects before it returns.
	- `Router.global.go(n).then(...)` - Move `n` history entries forward if positive, backward if negative.
		- The returned promise awaits the next route's rendering and all applicable redirects before it returns.
	- `Router.global.back()` - Go back to the previous history entry.
		- Sugar for `Router.global.go(-1)` and returns the resulting promise.
	- `Router.global.forward()` - Go back to the next history entry.
		- Sugar for `Router.global.go(1)` and returns the resulting promise.
	- When no DOM exists, the default history throws an error from every method.

- `Router.match({...routes, default, current?, router = Router.global})` - Dispatch based on a route.
	- `current = href | {href, state}` forces a current route with optional associated state, ignoring the history altogether. Passing a string is equivalent to passing `{path: current, state: null}`. Don't use this unless you're rendering to a string or similar.
	- `default:` is the fallback route if no route is detected, if no routes match, or if the current route's `href` is literally `""`. (required)
	- `router:` - The global router instance to use.
	- `"/route/:param": (params, match) => ...` - Define a route
		- `params` contains both query params and template params.
		- `match` is a child matcher, which carries the same prototype of `Router.match` minus `router` support. Note that 1. a child `current:` overrides the parent `current:` and 2. the raw relative prefix itself is not directly accessible. This need not be directly returned.
		- Invoke `match({href, ...opts})` or `match("/path")` to replace the current route to a particular sibling path. The first form is detected via the presence of an `href` parameter.
		- Invoke `match("next")` to return the result from the next matching path. This can be done anywhere, including in child views or even passed as a value elsewhere.
		- This can return either `match`/`Route.match` to skip or a value. The value need not be a vnode, but it can be.
		- This is exact by default, but the prefix carried by the context specifically *excludes* any final parameter, either `:param` or `:param...`.
	- When there is no active history (as in, when running without a global DOM and without an explicit `history:`), `current` is required.
	- If you want a 404 route, define a final route of `"/:path...": () => ...`.
	- Note: this returns a cell. So this *can* be used independently of Mithril's view.

- `m(Router.Link, {router = Router.global, alert?, ...opts}, elem)` - Create a link using the router's parent's implicit prefix
	- `children: [elem]` - An element to hook into with `onclick` + `href` (required)
	- `elem.attrs.href` - The target to route to.
	- `router:` - The global router instance to use.
	- `alert: string` - A string to `window.confirm` with, in case you want to block navigation. If `null`/`undefined`, no alert is attempted.
	- All other component attributes, like `replace: true`, are passed straight to `router.set(href, opts)` as router options

- `m(Router.Back, {router = Router.global, n = -1, alert?}, elem)` - Create a link using the router's parent's implicit prefix
	- `children: [elem]` - An element to hook into with `onclick` (required)
	- `router:` - The global router instance to use.
	- `n:` - The numeric offset to go back to, used for `router.go(n)`. Pass `n: -1` to go back to the previous history entry or `n: 1` to go back to the history entry you last went back from.
	- `alert: string` - A string to `window.confirm` with, in case you want to block navigation. If `null`/`undefined`, no alert is attempted.

If it helps to see what the shape of the API itself looks like, a full, relatively precise TS definition of the above would look like this:

```ts
export const global: {
	// Main API
	prefix: string;
	set(href: string, options: {
		state?: object;
		replace?: boolean;
		title?: string;
	}): Promise<void>;
	go(n: string): Promise<void>;

	// Extra to implement the `Router` interface. Little need exists to invoke
	// these methods in normal code.
	confirm(message: string): boolean;
	subscribe(callback: () => any): () => any;
	resolve(url: string): string;
	at(n: number): {href: string, state: string};
};

// Not a real type - the method itself just returns `undefined`
// type Redirect = unique undefined
const redirect: unique symbol;
interface Redirect { [redirect]: never }

type MaybeRouterOpt = {
	router?: Router | void | null | undefined;
};

type RouterOpt<O extends MaybeRouterOpt> =
	O extends {router: Router} ? O["router"] : typeof global;

// Can't do this because TypeScript checks for recursive *bindings* (with
// interfaces and properties not normally recursed), not recursive *types*.
// type MatchResult<Result> = Result | Redirect | Cell<MatchResult<Result>>;
type MatchResult<Result> = Result | Redirect | (
    (send: CellSend<MatchResult<Result>>) => void | CellDone
);

interface MatchOpts<R extends Router, Result> {
	current?: RouterHistory<R>["href"] | RouterHistory<R>;
	default: string;
	[route: string]: (params: object, match: {
		(options: MatchOpts<R, Result>): Cell<Result>;
		(next: "next"): MatchResult<Result>;
		(href: string, options?: SetOptions<R>["options"]): Redirect;
	}) => MatchResult<Result>;
}

export function match<O extends MaybeRouterOpt, Result>(
	options: O & MatchOpts<RouterOpt<O>, Result>
): Cell<Result>;

export function Link<A extends MaybeRouterOpt>(
	attrs: Cell<
		SetOptions<RouterOpt<A>> &
		A &
		{alert?: string, children: [ElementVnode<string, {href: string}>]}
	>
): (
	typeof attrs extends Cell<{children: [ElementVnode<infer T, infer A>]}> ?
	Cell<ElementVnode<T, {
		[K in keyof Exclude<keyof A, "href">]: A[K];
		href: string;
		onclick(event: Event): false;
	}>> :
	never
);

export function Back(
	attrs: Cell<MaybeRouterOpt & {
		alert?: string;
		children: [ElementVnode<string, any>];
		n?: number;
	}>
): (
	typeof attrs extends Cell<{children: [ElementVnode<infer T, infer A>]}> ?
	Cell<ElementVnode<T, {
		[K in keyof Exclude<keyof A, "href">]: A[K];
		href: string;
		onclick(event: Event): false;
	}>> :
	never
);
```

### Custom routers

Custom routers implement the following interface:

```ts
type SetOptions<R extends Router> =
	R["set"] extends ((href: string, options?: infer O) => any) ? O : never;

type RouterHistory<R extends Router> =
	R["at"] extends ((n: number) => infer R) ? R : never;

// So I can use a `this` type in a child `this` context.
type _SetOptions<R extends Router> = {state?: RouterHistory<R>["state"]};
interface Router {
	// Required by `Router.match` and `Router.link`
	// Set the current history entry to `href` with router-specific `opts`.
	set(
		href: RouterHistory<this>["href"],
		options?: _SetOptions<this>
	): any;

	// Required by `Router.match`
	// Register a callback to be called on each update and return a function to
	// remove the previously registered callback. Duplicates must be tolerated,
	// since `Router.match` may choose to reuse subscription callbacks, as could
	// other users.
	subscribe(callback: () => any): () => any;

	// Required for `Router.Link`
	// Resolve a URL into one that could be used for external navigation.
	resolve(url: string): string;

	// Required for `Router.Back`
	// Move `n` history entries forward if positive, backward if negative.
	go(n: number): any;

	// Required for `Router.Link` and `Router.Back` when `alert` is non-`null`,
	// non-`undefined`.
	// Confirm navigation with a message to the user and return `true` if
	// approved, `false` if rejected.
	confirm(message: string): boolean | PromiseLike<boolean>;

	// Required for `Router.Back` and `Router.match`
	// Return the history entry at offset `n` relative to this on, or `null`/
	// `undefined` if no known such URL can be determined. Note that `0` is the
	// current history entry.
	at(n: number): {href: string, state: string};
}
```

The above methods are similarly implemented by the global router with URLs being relative to the prefix, but you generally shouldn't need to call these aside from `Router.global.set(...)` and `Router.global.go()`, documented earlier. (Those also helpfully return promises, where this requires no such thing.)

### Notes

- Prefer `Router.Link` and `Router.Back` over explicit `router.set(...)` and `router.go(n)` for anything like back buttons and links. Mithril handles most of the boilerplate and it also covers accessibility issues as necessary.
- Each of these wrap inconsistencies in the router passed via `router:`. Note that prefix stripping is a router feature, not a framework feature!
- `Router.Link` and `Router.Back` create vnodes via a raw object (avoiding the direct `mithril/m` dependency), but this is otherwise fully zero-dependency, so you *could* use this in both cells and the virtual DOM tree without issue.
- You can have multiple separate `Router.match` instances active at once. So for example, you could use one in your navigation to select which item is considered "active" *and* one in the main page to select which page body to render. As mentioned above, it returns a cell that passes through its output, so you can still use it in other contexts like your data model.
- This is necessarily somewhat larger than the current v2 router, because of the dynamic route matching.

Also, `Router.Link` should be changed to work like this, for better accessibility and compatibility:

```js
Router.Link = (attrs) => (render) => attrs({
	router = Router.global,
	children: [{tag, attrs: {onclick, href, ...attrs}}],
	...opts
}) => {
	render({tag, attrs: {
		...attrs,
		href: router.resolve(href),
		onclick(ev) {
			if (typeof onclick === "function") {
				if (onclick.call(this, ev) === false) return false
			} else if (onclick != null && typeof onclick === "object") {
				onclick.handleEvent(ev)
			}

			if (
				// Skip if `onclick` or a prior listener prevented default
				!ev.defaultPrevented &&
				// Ignore everything but left clicks
				(ev.button === 0 || ev.which === 0 || ev.which === 1) &&
				// Let the browser handle `target="_blank"`, etc.
				(!this.target || this.target === "_self") &&
				// No modifier keys
				!ev.ctrlKey && !ev.metaKey && !ev.shiftKey && !ev.altKey
			) Router.push({href, ...opts})

			return false
		},
	}})
})
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
- The `request({url, ...opts})` variant is removed - only the `request(url, opts?)` variant remains. (Picked this one for consistency with routing and `fetch`.)
- Abort signals can be provided via a `signal:` parameter for compatibility with `fetch`. Note that anything with an `onabort` property can work for this, not just an abort controller.
	- This replaces `xhr.abort()` in the `config:` callback. Don't call that directly - pass `controller.signal` and invoke `controller.abort()` on the corresponding controller instead, or just use `abortable` from [`mithril/dom`](core.md#dom-renderer-api).

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

## Vnode renderer

This is exposed under `mithril/render-vnode`.

- `renderVnode(vnode, {retainEventHandlers = false})` - This renders a vnode with potential components and similar to a resolved vnode tree without those components.
	- Fragments are always normalized to objects
	- Numbers and similar are normalized to strings
	- Booleans and `null` are normalized to `undefined`
	- Components are replaced with their contents
	- Control vnodes are replaced with their synchronously rendered tree as applicable
	- DOM event handlers are replaced with a single shared global function unless `retainEventHandlers` is truthy
	- Everything else is as you would expect

### Why?

It's a very common need for testing purposes. It also carries a similar benefit `mithril/render-html` does for figuring out what needs exposed for renderers.

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

This is implemented [here](src/cell.mjs), with an optimized implementation [here](src/optimized/cell.mjs). This is actually *smaller* than streams, despite providing better, more powerful functionality.

Notes:

- Each of these are written to be resilient against synchronous updates.
- None of these have any dependencies on anything other than just the language itself. This means you can freely use this anywhere for all its benefits, without fear.

### Why?

A few reasons:

- You often want to manipulate cells to new values, but doing it all manually is *very* tedious.
- Components can be functions from a cell of attributes to a vnode tree, so lifecycle hook naturally fall from the model.
- This is what would be our answer to React Hooks, just substantially lower in overhead.
- Most streaming utilities can directly translate to this.

Also, there's a handful of helpers [here](https://github.com/isiahmeadows/mithril.js/tree/redesign/helpers) based on [some of these hooks](https://usehooks.com/), in case you want to know what it could look like in practice.

This utility is about the same size than Mithril's existing streams utility when minified and gzipped. Also, the names compress a bit better when bundled with other things, especially if you use Rollup, and it ends up comparable in source size *to* code using hooks exclusively, if not sometimes substantially smaller.
