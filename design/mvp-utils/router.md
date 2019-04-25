[*Up*](README.md)

# Router API

This is exposed under `mithril/router` and in the full bundle via `Mithril.Router`. The default export is a global router instance. It depends on the internal path parsing utilities and a native `Promise`, but that's it.

- `Router.initialize(router)` - Set the global router.
	- There is no default to keep it DOM-independent, so you will usually want to call either `Router.initialize(Router.dom({prefix?}))` or `Router.initialize(Router.memory)`

- `Router.set(href, opts).then(...)` - Set the current route.
	- The parameters are directly passed to the current router.
	- `href` - The target URL to move to. Specifying a string is equivalent to passing this without parameters.
	- `opts.replace` - Whether to replace the current history entry or append a new one.
	- `opts.state` - The state to associate with the history entry.
	- The returned promise awaits the next route change and all applicable redirects before it returns.

- `Router.resolve(route)` - Resolve the route to an external URL.

- `Router.go(n).then(...)` - Move `n` history entries forward if positive, backward if negative.
	- The returned promise awaits the next route change and all applicable redirects before it returns.

- `Router.back()` - Go back to the previous history entry.
	- Sugar for `Router.go(-1)` and returns the resulting promise.

- `Router.forward()` - Go back to the next history entry.
	- Sugar for `Router.go(1)` and returns the resulting promise.

- `Router.match({...routes, default, current?})` - Dispatch based on a route.
	- `current = href | {href, state}` forces a current route with optional associated state, ignoring the history altogether. Passing a string is equivalent to passing `{path: current, state: null}`. Don't use this unless you're rendering to a string or similar.
	- `default:` is the fallback route if no route is detected, if no routes match, or if the current route's `href` is literally `""`. (required)
	- `"/route/:param": (params, match) => ...` - Define a route
		- `params` contains both query params and template params.
		- `match` is a child matcher, which carries the same prototype of `Router.match`. Note that 1. a child `current:` overrides the parent `current:` and 2. the raw relative prefix itself is not directly accessible. This need not be directly returned.
		- Invoke `match(href, {...opts})` or `match("/path")` to replace the current route to a particular sibling path. The first form is detected via the presence of an `href` parameter.
		- Invoke `match(false)` to return the result from the next matching path. This can be done anywhere, including in child views or even passed as a value elsewhere.
		- This can return either `match`/`Route.match` to skip or a value. The value need not be a vnode, but it can be.
		- This is exact by default, but the prefix carried by the context specifically *excludes* any final parameter, either `:param` or `:param...`.
	- When there is no active history (as in, when running without a global DOM and without an explicit `history:`), `current` is required.
	- If you want a 404 route, define a final route of `"/:path...": () => ...`.
	- Note: this returns a stream. That means this *can* be used independently of Mithril's view, and can really be used almost anywhere.

- `m(Router.Link, opts, elem)` - Create a link that changes to a new route on click.
	- `children: [elem]` - An element to hook into with `onclick` + `href` (required)
	- `elem.attrs.href` - The target to route to.
	- You can prevent navigation by returning `false` from the target's `onclick` event handler.
	- All other received attributes, like `replace: true`, are passed straight to `Router.set(href, opts)` as `opts`

- `m(Router.Go, {n = -1}, elem)` - Create a link that traverses the history stack on click
	- `children: [elem]` - An element to hook into with `onclick` (required)
	- `n:` - The numeric offset to go back to, used for `Router.go(n)`. Pass `n: -1` to go back to the previous history entry or `n: 1` to go back to the history entry you last went back from.
		- `n: "back"` is sugar for `n: -1`
		- `n: "forward"` is sugar for `n: 1`
	- You can prevent navigation by returning `false` from the target's `onclick` event handler.

If it helps to see what the shape of the API itself looks like, a full, relatively precise TS definition of the above would look like this:

```ts
export interface CurrentRouterOpts {}

// When you do this, also do the following alongside it, or it won't type-check:
//
// ```ts
// declare module "mithril/router" {
// 	interface CurrentRouterOpts extends YourRouterOpts {}
// }
//
// // For `Router.dom(...)`
// declare module "mithril/router" {
// 	interface CurrentRouterOpts extends DOMRouterOpts {}
// }
//
// // For `Router.memory`
// declare module "mithril/router" {
// 	interface CurrentRouterOpts extends MemoryRouterOpts {}
// }
// ```
//
// I've actually verified this works. The error message will be somewhat
// misleading if you forget, but it will still be correctly rejected.
export function initialize(router: Router<RouterOpts>): void;

export function set(
	href: CurrentRouterOpts["entry"]["href"],
	opts: CurrentRouterOpts["set"]
): Promise<void>;

export function set(
	href: {} extends CurrentRouterOpts["set"] ?
		CurrentRouterOpts["entry"]["href"] :
		never,
	opts?: CurrentRouterOpts["set"]
): Promise<void>;

export function resolve(href: CurrentRouterOpts["entry"]["href"]): string;
export function go(n: number): Promise<void>;
export function back(): Promise<void>;
export function forward(): Promise<void>;

// Not a real type - the method itself just returns `undefined`
// type Redirect = unique undefined
const redirect: unique symbol;
interface Redirect { [redirect]: never }

// Can't do this because TypeScript checks for recursive *bindings* (with
// interfaces and properties not normally recursed), not recursive *types*.
// type MatchResult<R> = R | Redirect | Stream<MatchResult<R>>;
type MatchResult<R> = R | Redirect | (
    (o: StreamObserver<MatchResult<R>>) => StreamDone
);

interface MatchOpts<R> {
	current?:
		void | null | undefined |
		CurrentRouterOpts["entry"]["href"] |
		CurrentRouterOpts["entry"];
	default: string;
	[route: string]: (params: object, match: {
		(options: MatchOpts<R>): Stream<R>;
		(param: false): MatchResult<R>;
		(href: string, options?: CurrentRouterOpts["set"]): Redirect;
	}) => MatchResult<R>;
}

export function match<R>(options: MatchOpts<R>): Stream<R>;

export function Link(
	attrs: Stream<
		CurrentRouterOpts["set"] &
		{children: [ElementVnode<string, {href: string}>]}
	>
): Child;

export function Go(
	attrs: Stream<{
		n?: number | "back" | "forward";
		children: [ElementVnode<string, any>];
	}>
): Child;
```

### Routers

Routers, including both built-in and custom routers, implement the following interface:

```ts
type _RouterSetOpts<S> = {state?: S};

interface RouterOpts {
	entry: {href: string, state: object};
	set: _RouterSetOpts<this["entry"]["state"]>;
}

interface Router<O extends RouterOpts> {
	// Required by `Router.set`, `Router.match`, and `Router.Link`
	// Set the current history entry to `href` with router-specific `opts`.
	set(this: Router<O>, href: O["entry"]["href"], options: O["set"]): any;
	set(this: {} extends O ? this : never, href: O["entry"]["href"]): any;

	// Required by `Router.match`, `Router.set`, and `Router.go`
	// Register a callback to be called on each update and return a function to
	// remove the previously registered callback. Duplicates must be tolerated,
	// since `Router.match` may choose to reuse subscription callbacks, as could
	// other users.
	subscribe(callback: () => any): () => any;

	// Required for `Router.Link` and `Router.Go`
	// Resolve a URL into one that could be used for external navigation.
	resolve(url: O["entry"]["href"]): string;

	// Required for `Router.Go` and `router.go`
	// Move `n` history entries forward if positive, backward if negative.
	go(n: number): any;

	// Required for `Router.Go`
	// Return the history entry at offset `n` relative to this on, or `null`/
	// `undefined` if no known such URL can be determined. Note that `0` is the
	// current history entry.
	at(n: number): void | null | undefined | O["entry"];
}
```

Two built-in routers exist:

- `dom(opts)` - Create a DOM router. This is exposed from `mithril/dom` and in the full bundle via `Mithril.dom`.
	- `opts.prefix` - The global prefix to use.
		- When the prefix starts with `#`, routing is based on the URL's hash.
		- When the prefix starts with `?`, routing is based on the URL's query + hash.
		- When the prefix starts with anything else, routing is based on the full URL path, query, and hash.
		- The default prefix is `"#!"`.
	- Usually used via `Router.initialize(Router.dom(opts))`
	- Extra `set` options:
		- `opts.title` - The title of the history entry. Currently, out of all major browsers, this only affects the UI in Firefox, but it exists in case people want to use it.

- `memory` - Get the in-memory router. This is exposed from `mithril/router` and in the full bundle via `Mithril.Router.memory`.
	- Usually used via `Router.initialize(Router.memory)`

Here's the TS definitions for those:

```ts
declare module "mithril/dom" {
	export type DOMRouterOpts = {
		entry: {
			href: string;
			state: object;
		};
		set: {
			state?: object;
			replace?: boolean;
			title?: string;
		};
	};

	export function dom(opts: {prefix?: string}): Router<DOMRouterOpts>;
}

declare module "mithril/router" {
	export type MemoryRouterOpts = {
		entry: {
			href: string;
			state: object;
		};
		set: {
			state?: object;
			replace?: boolean;
		};
	};

	export const memory: Router<MemoryRouterOpts>;
}
```

### Notes

- Prefer `Router.Link` and `Router.Go` over explicit `router.set(...)` and `router.go(n)` for anything like back buttons and links. Mithril handles most of the boilerplate and it also covers accessibility issues as necessary.
- Each of these wrap inconsistencies in the router passed via `router:`. Note that prefix stripping is a router feature, not a framework feature!
- `Router.Link` and `Router.Go` create vnodes via a raw object (avoiding the direct `mithril/m` dependency), but this is otherwise fully zero-dependency, so you *could* use this in both streams and the virtual DOM tree without issue. Also, those can easily shake out.
- You can have multiple separate `Router.match` instances active at once. So for example, you could use one in your navigation to select which item is considered "active" *and* one in the main page to select which page body to render. As mentioned above, it returns a stream that passes through its output, so you can still use it in other contexts like your data model.
- This is necessarily somewhat larger than the current v2 router, because of the dynamic nature of it all.

Also, `Router.Link` and `Router.Go` should work like this, for better accessibility and compatibility:

```js
function view(o, tag, attrs, onclick, href, set) {
	o.next({tag, attrs: {...attrs, href, onclick(ev) {
		if (
			(
				typeof onclick !== "function" ||
				onclick.call(this, ev) !== false
			) &&
			// Skip if `onclick` or a prior listener prevented default
			!ev.defaultPrevented &&
			// Ignore everything but left clicks
			(ev.button === 0 || ev.which === 0 || ev.which === 1) &&
			// Let the browser handle `target="_blank"`, etc.
			(!this.target || this.target === "_self") &&
			// No modifier keys
			!ev.ctrlKey && !ev.metaKey && !ev.shiftKey && !ev.altKey
		) set()

		return false
	}}})
}

Router.Link = (attrs) => (o) => attrs({
	children: [{tag, attrs: {onclick, href, ...attrs}}],
	...opts
}) => {
	view(o, tag, attrs, onclick, Router.resolve(href),
		() => Router.push(href, opts)
	)
})

Router.Go = (attrs) => (o) => attrs({
	n, children: [{tag, attrs: {onclick, ...attrs}}],
}) => {
	if (n === "back" || n == null) n = -1
	else if (n === "forward") n = 1
	const result = Router.at(n)
	view(o, tag, attrs, onclick,
		result != null ? Router.resolve(result.href) : undefined,
		() => Router.push(href, opts)
	)
})
```

### Why?

Well, the need for routing is obvious, but there are a few key differences from the existing system I'd like to explain.

- Routing is partially dynamic. Because you can invoke `match` at any point, you can load routes asynchronously and just invoke `match` lazily after the child is loaded. This is useful for async routes and lazy loading of common child layouts in larger apps.
- Routing returns a valid vnode. This means you can define a layout and on `render(dom, m(Layout, {...}))`, you can define in your children a simple route. On route change, your layout ends up preserved and *not* redrawn, while your page *is*.
- Routing returns a valid stream that doesn't itself to be mounted to the DOM, and it supports multiple entry points. This means you can use it not only in your views, but also in your model when certain state is route-dependent.
- Each of the various route setting methods return promises. That way, you get notified when the route change completes.
