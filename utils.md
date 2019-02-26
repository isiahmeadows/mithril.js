# Utilities

## Composable refs

This is exposed under `mithril/ref` and in the core bundle via `m.ref`. It exists to help make refs considerably more manageable.

- `refs = m.ref.join([...keys], ({...elems}) => ...)` - Create a combined ref that invokes a callback once all named refs are received.
    - `refs.key` - Get a ref linked to that callback key
- `refs = m.ref.all(len, ([...elems]) => ...)` - Create a combined ref that invokes a callback once all indexed refs are received.
    - `refs[index]` - Get a ref linked to that callback index.
    - `refs.empty` - Get a ref called to send an empty array, or `undefined` if indexed refs exist.
- `refs = m.ref.create(({...elems}) => ...)` - Similar to `m.ref.join(...)`, but lets you create the refs on demand.
- `refs = m.ref.proxy(({...elems}) => ...)` - Similar to `m.ref.join(...)`, but exposes the refs via a proxy.

Note: The resulting refs only propagate the first argument, the element or component ref. If you want to include element lengths, do something like `refs.key({elem, index})`. These don't actually care about the values themselves.

This is implemented in [CJS + ES5](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/cjs/ref.js) and [ESM + ES2018](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/esm/ref.js).

## Portal combinators

This is exposed under `mithril/portal`.

These are useful for easier manipulation of portals.

- `{Get, Set, token} = Portal.create(token = {})` - Create a getter/setter portal pair
	- Set value: `m(Set, {value}, ...)`
	- Get value: `m(Get, {default}, value => ...)`
    - The token is optionally generated internally, but is exposed via `token`.
- `m(Portal.Get, {portals: Array<portal | [portal, default]>}, ([...values]) => ...)`, `m(Portal.Get, {portals: Record<string, portal | [portal, default]>}, ({...values}) => ...)` - Get multiple portals at once
- `m(Portal.Set, {portals: Array<[portal, value]>}, ...)` - Set multiple portals at once
- `m(Portal.Update, {portals: Array<[portal, value, default]>}, ([...values], [...prev]) => ...)`, `m(Portal.Get, {portals: Record<string, [portal, value, default]>}, ({...values}, {...prev}) => ...)` - Update multiple portals at once, emitting the callback with the previous and subsequent values

Note that for `Portal.Get`/etc., you have to wrap the token in a `Portal.create` first.

## Router API

This is exposed under `mithril/route`.

- `m(Route.Router, {prefix, default, history, onredirect, ...routes})` - Define routes
    - `"/route/:param": (params, history) => ...` - Define a route
        - `params` contains both query params and template params
        - `history` contains a history proxy you can `.push(opts)` and `.pop()` to and you can get the `.current()` href + state
        - This is exact by default, but the prefix carried by the context specifically *excludes* any final parameter, either `:param` or `:param...`.
    - `prefix:` is the prefix to use in addition to the router's parent's prefix.
    - `default:` is the fallback route if no route is detected or if no routes match, used only when the prefix starts with either a `?` or a `#`.
    - `current: {href, state}` forces a current route, ignoring the history altogether. Passing a string is equivalent to passing `{path: current, state: null}`. Don't use this unless you're rendering server-side.
    - `history:` is the global history instance to use, a `{current(): {href, state}, push(href, state, title, replace), pop(), subscribe(cb)}` object where each of those returns a potential promise. Defaults to one that just manipulates the URL based on the `prefix` if a DOM exists.
        - The return values of `history.push(...)` and `history.pop()` are ignored.
        - When this is passed, it's not added as a child router but a new top-level router.
    - When running without a global DOM, you *must* pass at least one of `history:` or `current:`.
    - If you want a 404 route, define a final route of `"/:path...": () => ...`.
    - Note: when defining child routes, `prefix`, `current`, and `history` are all ignored.
- `SKIP` - Skip the current route and render the next matching route
    - This can be returned even when the route itself was previously rendered
    - This must be returned directly from a route view - an error will be thrown otherwise.
- `m(Route.Redirect, {...})` - Redirect to another route.
    - This simply does `history.push({...attrs, replace: true})` on initialization.
    - This can be returned even when the route itself was previously rendered.
- `m(Route.Link, {...})` - Create a link using the router's parent's implicit prefix
    - `href:` - The path to route to (required)
    - `tag:` - The tag name to render as the vnode
    - `attrs:` - Other attributes to set on the element itself
    - `params:`, `replace:`, `state:`, `title:` - Other options passed through to `history.push`
- `history = router.history` - Get the context's history object
    - `{href, state} = history.current()` - Get the current route with the prefix spliced off.
    - `history.push(href | setOpts).then(...)` - Set the current route, taking into account any prefix.
        - `opts.href` - The target URL to move to. Specifying a string is equivalent to passing this without parameters.
        - `opts.params` - The data you want to interpolate and append as query parameters
        - `opts.replace` - Whether to replace the current history state
        - `opts.state` - The state to associate with the history entry
        - `opts.title` - The title of the history entry
    - `history.pop().then(...)` - Go back to the previous route.
    - The returned promises
    - This is intentionally unwieldy. Prefer `Route.Link` where possible.
    - Each of these strips the prefix as necessary, and they wrap inconsistencies in the history passed to `Route.Route`.
- The original proposal was one of the few bits that was fairly close: https://github.com/MithrilJS/mithril.js/issues/2281
    - I just want to keep the URL handling changes of https://github.com/MithrilJS/mithril.js/pull/2361 in this.
    - I also wanted to discourage direct manipulation.

## Request API

This is exposed under `mithril/request`.

- JSONP support is gone. It's basically obsolete now in light of CORS being available on all supported platforms, and our code is easy to just copy if necessary.

Beyond that, the API is probably fine as-is.

## Async loading sugar

This is exposed under `mithril/async`.

Basically https://github.com/MithrilJS/mithril.js/issues/2282.

This is implemented in [CJS + ES5](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/cjs/async.js) and [ESM + ES2018](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/esm/async.js).

### Why?

1. It makes lazy resource loading *way* easier to manage.
1. It takes all the boilerplate out of CRUD-like views.
1. It enables something like [`React.lazy`](https://reactjs.org/docs/code-splitting.html#reactlazy) + [`React.Suspense`](https://reactjs.org/docs/code-splitting.html#suspense), but it's generalized and makes error handling a bit easier.
1. Together with `Route` above, async route loading is practically trivial.
1. One might conceptualize a component + server-side helper built on this + `m.hydrate` + `mithril/render-html` to create delimited components that incrementally load from the server as needed, with implicit HTML hydration to speed it up significantly. With React, it's *possible* to build something through mixing `React.lazy` + `React.suspense`, but it's not something you could just put together in a weekend on your own.

## HTML renderer

This is exposed under `mithril/render-html`.

Basically `mithril-node-render`, moved into core.

### Why?

1. It lets us keep API changes much more tightly integrated.
1. It helps us determine more easily what's common between single-shot and retained renderers, so we can know what abstractions to expose.
1. It makes our SSR support much more discoverable.
1. It's a much simpler upgrading story.

## Subtree rendering API

This is exposed under `mithril/subtree`.

It's a simple component that sugars over `m.mount`/`m.render` for controlled subtree redrawing.

- `m(Subtree, () => ...)` - Define a subtree

When a subtree component invokes `context.update()`, updates are restricted to that subtree, not performed globally.

### Why?

1. Performance concerns *do* come up in larger apps. This is meant to help them scale better.
1. This isn't exactly easy nor obvious to get right, especially when memory leaks get involved.
1. By making subtrees opt-in in this fashion, I can form a closure over the attributes *only* as I need to, avoiding the need to store that all in the vnode itself.
