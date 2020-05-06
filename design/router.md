[*Up*](README.md)

# Router API

This is exposed under `mithril/router`. It depends on the internal path parsing utilities, the hyperscript API and a native `Promise`, but that's it.

## Router instances

- `unregister = router.register(info)` - Register a component info object, to redraw on route change
    - `unregister()` - Unregister a component info object, so it doesn't get called on future route changes.
    - `route` uses this to properly handle subscription of route points.
    - This allows multiple entry points with ease.

- `router.path` - The full matched path with query parameters.

- `router.state` - The current history state.

- `router.goTo(route, options?).then(...)`, `router.goTo(offset).then(...)` - Set the current route.
    - The parameters are directly passed to the current router.
    - `route` - The target route or offset to navigate to.
        - It *must* start with a `/`, as routes normally do. If it's a string other than that, a literal `"previous"`, or a literal `"next"`, an error is thrown for sanity's sake.
    - `offset` - The target offset to navigate to.
        - If `offset === 1`, go forward one history entry.
        - If `offset === -2`, go back 2 history entries.
        - If `offset === 0`, reload the current route.
        - If a history entry cannot be found, an error is thrown.
    - `options.replace` - Whether to replace the current history entry or append a new one.
        - Note: it needs to be noted that this does *not* have a real effect on user's history UI, only in terms of the HTML history API. So although it's advised for redirects, it's currently redundant until browsers fix their history UIs to follow the spirit of the spec. (There's mentions of it in various places, including Twitter, and active bugs exist for Firefox and Chrome both.)
    - `options.title` - The title to associate with the history entry.
    - `options.state` - The state to associate with the history entry.
    - The returned promise awaits the next route change and all applicable redirects before it returns.
    - If `offset` is 0, this does nothing.

- `router.resolve(route)`, `router.resolve(offset)` - Resolve the route or offset to an external URL.
    - If a history entry cannot be found, an error is thrown.

Two built-in router instances exist:

- `DOM` - The DOM instance.
    - `DOM.prefix` - The global prefix to use. Initially set to `document.baseURI + "#!"`
    - This requires HTML5 history support, but will need to include a fallback to `onhashchange` for hash changes to work around [this IE/old Edge bug](https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/3740423/#comment-9).
        - Need to ask someone involved with https://github.com/browserstate/history.js if this bug has a workaround in their library, because I'd likely have to adopt a similar fix/workaround.
        - Might be easiest to just watch for both and ignore duplicate requests if they were received by the other listener.
    - Extra `set` options:
        - `options.title` - The title of the history entry. Currently, out of all major browsers, this only affects the UI in Firefox, but it exists in case people want to use it.

- `Memory` - The in-memory instance.
    - `Memory.initial` - The initial global path to start with.
    - Useful for testing and why it's here.

## Route matching

- `route(DOM | Memory, ({router, path, query, state}) => vnode)` - Set the global router instance to a given instance.
    - To keep it agnostic of environment, there is no default instance.
    - This allows you to do things like inject a memory router for testing and the DOM router for production.
    - This makes it much easier to handle subrouting.
    - `router` - The router passed above.
    - `path` - The full resolved path with query parameters removed.
    - `query` - The query parameters.
        - This is a plain object generated from `parseQuery` from [`mithril/path`](path.md).
    - `state` - The current history state.
    - For convenience, this also sets the above variables in the `mithril/route` environment key.

- `route(target, (params) => vnode)` - Define a route.
    - This must be nested at least indirectly within a `route(Instance, ...)` route.
    - `target` - A [route template](#route-syntax).
    - `params` - The match result as explained in the [route syntax](#route-syntax). This does *not* include query parameters.
    - `vnode` - The resulting vnode to render for this route.
    - This returns a vnode representing the currently renderered route.

- `route(null, () => vnode)` - Define a fallback route.
    - This must be nested at least indirectly within a `route(Instance, ...)` route.
    - `vnode` - The resulting vnode to render for this route.
    - This returns a vnode representing the currently renderered route.

## Links

Links are *really* easy: just drop a `linkTo(target, options?)` in whatever you want to route whenever it gets clicked.

```js
// Leave the `href` out of your `a`. It'll be fine. (If you want isomorphic,
// Mithril might not have the prefix until runtime anyways.)
m("a", linkTo("/"), "Home")
```

- `linkTo(href, options?)`, `linkTo(offset)` - Create a link that changes to a new route on click.
    - The `href`, `options`, and `offset` parameters are the same as with `router.goTo`, so you can use either `linkTo(...)` or `router.goTo(...)`.
    - Pass this in the body of an element, like `m("a", linkTo(...))`. It adds an appropriate listener and `href` attribute.
    - You can prevent navigation by returning `false` from the target's `onclick` event handler.
    - This reads the context variable `router` to get its router instance.

That utility would just be implemented like this, just using the framework:

```js
export function linkTo(target, options) {
    return m.state((info, {router}) => ({
        href: router.resolve(target),
        on: {click(ev, capture) {
            if (
                // Skip if a prior listener prevented default
                !ev.defaultPrevented &&
                // Ignore everything but left clicks
                (ev.button === 0 || ev.which === 0 || ev.which === 1) &&
                // No modifier keys
                !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && !ev.altKey &&
                // Let the browser handle `target="_blank"`, etc.
                (!ev.target || ev.target === "_self")
            ) {
                capture.event()
                // Redrawing at this stage is not meaningful.
                capture.redraw()
                return router.goTo(target, options)
            }
        }}
    }))
}
```

### Route syntax

Here's how route templates are matched:

- `/a/b` - Matches a literal `"/a/b"` or `"/a/b/"` prefix, saves no matches
- `/:a/:b` - Matches the regexp `/^\/([^/.-]*)\/([^/.-]*)\/?/`, saves `{a: exec[1], b: exec[2]}` where `exec` is the `exec` result.
- `/:a-:b` - Matches the regexp `/^\/([^/.-]*)-([^/.-]*)\/?/`, saves `{a: exec[1], b: exec[2]}` where `exec` is the `exec` result.
- `/:a.:b` - Matches the regexp `/^\/([^/.-]*)\.([^/.-]*)\/?/`, saves `{a: exec[1], b: exec[2]}` where `exec` is the `exec` result.
- `/:a/:b...` - Matches the regexp `/^\/([^/.-]*)(|\/.*)$/`, saves `{a: exec[1], b: exec[2] || "/"}` where `exec` is the `exec` result.
    - Child routes must not exist for this variant.
- No characters may exist after a `:param...` parameter, for practical reasons and a simpler implementation.
- Trailing (like `/a/b/`) and duplicate (like `/a//b`) path delimiters are stripped from both patterns and routes prior to matching.
- Routes with `.` or `..` path components are redirected to the default route and log an error.
- Patterns with `.` or `..` path components result in an error being thrown.

All matching routes are rendered, regardless of whether other routes match or not. The only exception is the catch-all `route(null, () => vnode)`

### Notes

- Prefer `linkTo` and friends over explicit `router.goTo(...)` and similar for anything like back buttons and links. Mithril handles most of the boilerplate and it also covers accessibility issues as necessary.
- Each of these wrap inconsistencies in the router passed via `router:`. Note that prefix stripping is a router feature, not a framework feature!
- You can have multiple separate `router.match` subtrees active at once. So for example, you could use one in your navigation to select which item is considered "active" *and* one in the main page to select which page body to render. As mentioned above, it returns a stream that passes through its output, so you can still use it in other contexts like your data model.
- This is necessarily going to be larger than the current v2 router, because of the dynamic nature of it all.

### Why?

Well, the need for routing is obvious, but there are a few key differences from the existing system I'd like to explain.

- Routing is dynamic. Because you can invoke `match` at any point, you can load routes asynchronously and just invoke `match` lazily after the child is loaded. This is *very* useful for async routes and lazy loading of common child layouts in larger apps.
- Routing can return a valid vnode. This means you can define a layout and on `render(dom, m(Layout, {...}))`, you can dispatch to the appropriate page. Very little thinking required here.
- Each of the various route setting methods return promises. That way, you get notified when the route change completes.
