[*Up*](README.md)

# Router API

This is exposed under `mithril/router`. It depends on the internal path parsing utilities, the hyperscript API and a native `Promise`, but that's it.

## Router class

- `router = new Router(backend)` - Create a global router instance, using a given backend.
    - To keep it DOM-independent, there is no default backend, so you will usually want to call either `new Router(DOM)` or `new Router(Memory)`

- `router = context["mithril/router"]` - Access the current router instance.
    - This is intentionally somewhat cumbersome. Don't use it if you can avoid it.
    - A page transition library might choose to override this with a full replacement instance, provided they provide all the properties detailed below.

- `router.path` - The full matched path, `undefined` in the root instance.

- `router.query` - The matched query parameters, `undefined` in the root instance.

- `router.prefix` - The current router prefix, `""` in the root instance. This does *not* include global prefixes like what `DOM` sets, nor does it include a full location.

- `router.goTo(route, options).then(...)`, `router.goTo(offset).then(...)` - Set the current route.
    - The parameters are directly passed to the current router.
    - `route` - The target route or offset to navigate to.
        - It *must* start with a `/`, as routes normally do. If it's a string other than that, a literal `"previous"`, or a literal `"next"`, an error is thrown for sanity's sake.
    - `offset` - The target offset to navigate to.
    - `options.exact` - For nested routers with a prefix, whether to ignore the prefix and just do global navigation.
    - `options.replace` - Whether to replace the current history entry or append a new one.
        - Note: it needs to be noted that this does *not* have a real effect on user's history UI, only in terms of the HTML history API. So although it's advised for redirects, it's currently redundant until browsers fix their history UIs to follow the spirit of the spec. (There's mentions of it in various places, including Twitter, and active bugs exist for Firefox and Chrome both.)
    - `options.state` - The state to associate with the history entry.
    - The returned promise awaits the next route change and all applicable redirects before it returns.
    - If `offset` is 0, this just reloads the current route.

- `router.resolve(route)` - Resolve the route to an external URL.

- `router.goBack()` - Move to the previous history entry.
    - Sugar for `router.goTo(1)` and returns the resulting promise.

- `router.goForward()` - Move to the next history entry.
    - Sugar for `router.goTo(-1)` and returns the resulting promise.

- `router.getURL(n)` - Get the URL at history offset `n`.
    - This is used to get the URL to later traverse to that history state, in case the user might leave the app and come back at that URL.

- `router.next()` - Render the next route and return it.
    - This is non-global in part to keep it agnostic of realm, but also in part to avoid stepping over the toes of routers.
    - This lets you asynchronously dictate whether you should fall through or not.
    - Note: if created in a `router.match(...)` call, this returns a vnode. If created in a `router.matchStream(...)` call, it returns the literal value.

- `router.match(fallback = "/", ...routes)` - Dispatch based on a route.
    - `router` - Specifies the router to use. This is usually `DOM` (after possibly setting `DOM.prefix`) or `Memory`, but it's always required.
    - `fallback` - Specify the fallback route if no routes match or if the current route's `href` is literally the empty string. By default, this is `"/"`, the most common route specified by far.
    - `...routes` - A possibly nested array of routes.
    - This returns a vnode representing the currently renderered route.
    - Each route is a `[route, body]` pair where:
        - `route` - A route template.
        - `body` - A `(params, router) => result` function.
        - `params` - The match result as detected above.
        - `query` - The query parameters read from the route's query string.
        - `router` - A nested router instance, with its prefix being the route minus any rest parameters.
        - `result` is the resulting vnode.
    - This structure ensures it can easily be typed with clear error messages, selectivity can be quickly determined, and that it's clear if you're matching a dynamic path.

## Links

Links are *really* easy: just drop a `linkTo(target, options?)` in whatever you want to route whenever it gets clicked.

```js
// Leave the `href` out of your `a`. It'll be fine. (If you want isomorphic,
// Mithril might not have the prefix until runtime anyways.)
m("a", linkTo("/"), "Home")
```

- `linkTo(options?)` - Create a link that changes to a new route on click.
    - The `options` parameter is the same as with `router.goTo`, so you can pass either `goTo(href, options?)` or `router.goTo(offset)`.
    - If the `href` starts with a `/`, it's read as a route. If it's an integer, `back`, or `forward`, it's converted to the appropriate offset.
    - Specify `href: "-N"` to go back N entries, `href: "+N"` to go forward N entries. For example, `href: "-2"` goes back 2 entries and `href: "+2"` goes forward two entries.
    - Pass this in the body of an element, like `m("a", linkTo(...))`. It adds an appropriate listener and `href` attribute.
    - You can prevent navigation by returning `false` from the target's `onclick` event handler.
    - All other received attributes, like `replace: true`, are passed straight to `router.goTo(href, options)` as `options` if `href` is provided. Otherwise, when it's using `router.traverseTo(to)`, it ignores the options.
    - This reads the context variable `mithril/router` to get its router instance.

- `linkBack()` - Sugar for `linkTo(-1)`

- `linkForward()` - Sugar for `linkTo(1)`

Those would all likely end up something like this:

```js
let linkForward = () => linkTo(1)
let linkBack = () => linkTo(-1)
let linkTo = (target, options) => context(({"mithril/router": router}) => ({
    href: router.getURL(target),
    onclick(ev, capture) {
        if (
            // Skip if a prior listener prevented default
            !ev.defaultPrevented &&
            // Ignore everything but left clicks
            (ev.button === 0 || ev.which === 0 || ev.which === 1) &&
            // No modifier keys
            !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && !ev.altKey &&
            // Let the browser handle `target="_blank"`, etc.
            (!this.target || this.target === "_self")
        ) {
            capture()
            return router.goTo(target, options)
        }
    }
}))
```

It's not magic at all - it's all just using the framework!

### Backends

Backends, including both built-in and custom backends, implement the following three methods:

- `unsubscribe = backend.init(render)` - Initialize the router instance with a `render(route)` callback and return an unsubscription callback.
    - `route` here is a string route key so the router knows when the route has successfully changed.
    - `router.match` uses this to properly handle subscription and unsubscription of external route changes.
    - This allows multiple entry points with ease.

- `backend.goTo(href, options = {})` - Set the current history entry to `href` with router-specific options.
    - This is used directly by `router.goTo` and indirectly by utilities like `linkTo(href, options?)`.
    - The result is coerced to a promise and awaited.

- `backend.goTo(n)` - Navigate to the history entry at offset `n` relative to the current history entry.
    - In plain English:
        - If `n === 1`, go forward one history entry.
        - If `n === -2`, go back 2 history entries.
        - If `n === 0`, reload the current route.
        - It should work similarly for all other values of `n`.
    - If a history entry cannot be found, it should throw an error.
    - The result is coerced to a promise and awaited.

- `url = backend.getURL(n | route)` - Get the URL at offset `n` relative to the current history entry or using `route`.
    - This returns a URL *string* target, suitable for the `href` attribute of an `<a>` or `<area>` element, not a literal `URL` instance.
    - If a history entry cannot be found, it should throw an error.
    - The result is coerced to a promise and awaited.

Two built-in backends exist:

- `DOM` - The DOM backend.
    - `DOM.prefix` - The global prefix to use. Initially set to `document.baseURI + "#!"`
    - This requires HTML5 history support, but will need to include a fallback to `onhashchange` for hash changes to work around [this IE/old Edge bug](https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/3740423/#comment-9).
        - Need to ask someone involved with https://github.com/browserstate/history.js if this bug has a workaround in their library, because I'd likely have to adopt a similar fix/workaround.
        - Might be easiest to just watch for both and ignore duplicate requests if they were received by the other listener.
    - Extra `set` options:
        - `options.title` - The title of the history entry. Currently, out of all major browsers, this only affects the UI in Firefox, but it exists in case people want to use it.

- `Memory` - The in-memory backend.
    - `Memory.initial` - The initial global path to start with.
    - Useful for testing and why it's here.

### Route syntax

Here's how route templates are matched:

- `/a/b` - Matches a literal `"/a/b"` route, saves no matches
- `/:a/:b` - Matches the regexp `/^\/([^/.-]*)\/([^/.-]*)/`, saves `{a: exec[1], b: exec[2]}` where `exec` is the `exec` result.
- `/:a-:b`- Matches the regexp `/^\/([^/.-]*)-([^/.-]*)/`, saves `{a: exec[1], b: exec[2]}` where `exec` is the `exec` result.
- `/:a.:b`- Matches the regexp `/^\/([^/.-]*)\.([^/.-]*)/`, saves `{a: exec[1], b: exec[2]}` where `exec` is the `exec` result.
- `/:a/:b...` - Matches the regexp `/^\/([^/.-]*)\/(.*)$/`, saves `{a: exec[1], b: exec[2]}` where `exec` is the `exec` result.
- `/:a-:b...` - Matches the regexp `/^\/([^/.-]*)-(.*)$/`, saves `{a: exec[1], b: exec[2]}` where `exec` is the `exec` result.
- `/:a.:b...` - Matches the regexp `/^\/([^/.-]*)\.(.*)$/`, saves `{a: exec[1], b: exec[2]}` where `exec` is the `exec` result.
- No characters may exist after a `:param...` parameter, for practical reasons. This lets me simplify this to not require regexps at all and just use `indexOf`, meaning it's both faster and easier to match each segment.

Precedence is dictated by the following rules, applied in order:

1. Earlier segment match > later segment match
1. Has literal > has `:param` > has `:rest...`
1. Specified earlier > specified later

To demonstrate these rules:

1. `/foo/create` matches `/foo/:method` before `/:id/create` because earlier segments are matched before later segments.
1. `/foo/create` matches `/foo/create` before `/:id/create` because literal segments are matched before segment parameters, and it matches `/foo/:name` before `/foo/:path...` because segment parameters are matched before rest parameters.
1. Given `router.match(["/:id/create", body], ["/:key/create", body])`, the `/:id/create` route would match before `/:key/create`.

### Notes

- Prefer `linkTo` and friends over explicit `router.goTo(...)` and similar for anything like back buttons and links. Mithril handles most of the boilerplate and it also covers accessibility issues as necessary.
- Each of these wrap inconsistencies in the router passed via `router:`. Note that prefix stripping is a router feature, not a framework feature!
- You can have multiple separate `router.match` subtrees active at once. So for example, you could use one in your navigation to select which item is considered "active" *and* one in the main page to select which page body to render. As mentioned above, it returns a stream that passes through its output, so you can still use it in other contexts like your data model.
- This is necessarily going to be larger than the current v2 router, because of the dynamic nature of it all.

### TypeScript definitions

If it helps to see what the shape of the API itself looks like, a full, relatively precise TS definition of the above would look like this:

```ts
interface BaseSetOpts {
    replace?: boolean;
    state?: any;
    exact?: any;
}

// Extend this with your own backend options.
interface LinkSetOpts extends BaseSetOpts {}

type BackendRender<State> =
    (route: string, state: State) => void

interface Backend<SetOpts extends BaseSetOpts> {
    init(render: BackendRender<SetOpts["state"]>): () => void;
    goTo(href: string, options?: SetOpts): any;
    goTo(n: number): any;
    getURL(target: string): string;
    getURL(offset: number): void | null | undefined | string;
}

type MatchResult = {readonly [key: string]: string};
type QueryResult = object & QueryResult;
interface QueryResult {
    readonly [key: string]: string | true | object & QueryResult;
}

type Route<V, SetOpts> =
    [string, (matched: MatchResult, router: Router<V, SetOpts>) => V];

export class Router<SetOpts extends BaseSetOpts, V = never> {
    constructor(backend: Backend<SetOpts>)
    goTo(offset: number): Promise<void>;
    goTo(href: string, options?: SetOpts): Promise<void>;
    goBack(): Promise<void>;
    goForward(): Promise<void>;
    getURL(target: string | number): string;
    getURL(target: string): string;
    getURL(offset: number): void | null | undefined | string;

    readonly prefix: string;
    readonly path: string;
    readonly query: QueryResult;
    readonly backend: Backend<SetOpts>;

    next(): V;
    match(...routes: Route<Child, SetOpts>[]): Child;
    matchStream<V>(...routes: Route<V, SetOpts>[]): Stream<V>;
}

export function linkTo(target: string, options?: LinkSetOpts): Child;
export function linkTo(offset: number): Child;
export function linkBack(): Child;
export function linkForward(): Child;

export const DOM: Backend<BaseSetOpts & {title?: string}> & {prefix: string};
export const Memory: Backend<BaseSetOpts> & {initial: string};
```

### Why?

Well, the need for routing is obvious, but there are a few key differences from the existing system I'd like to explain.

- Routing is partially dynamic. Because you can invoke `match` at any point, you can load routes asynchronously and just invoke `match` lazily after the child is loaded. This is *very* useful for async routes and lazy loading of common child layouts in larger apps.
- Routing can return a valid vnode. This means you can define a layout and on `render(dom, m(Layout, {...}))`, you can define in your children a simple route. On route change, your layout ends up preserved and *not* redrawn, while your page *is*.
- Routing can return a valid stream that doesn't itself to be mounted to the DOM, and it supports multiple entry points. This means you can use it not only in your views, but also in your model when certain state is route-dependent.
- Each of the various route setting methods return promises. That way, you get notified when the route change completes.
