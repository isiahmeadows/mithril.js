# Utilities

## Router API

This is exposed under `mithril/route`.

- `m(Route.Route, {prefix, default, context, ...routes})` - Define routes
    - `"/route/:param": (params, routeContext) => ...` - Define a route
        - `params` contains both query params and template params
        - `routeContext` has the route context you can later route from.
        - This is exact by default, but the prefix carried by the context specifically *excludes* any final parameter, either `:param` or `:param...`.
    - `prefix:` is the prefix to use in addition to the router's parent's prefix.
    - `default:` is the fallback route if no route is detected or if we're on the relative root route.
    - `context:` is the context to reconcile the routes under.
    - `child` is a child router context.
- `Route.SKIP` - Return this from a route to skip it and render the next route
    - This can be returned even when the route itself was previously rendered
- `Route.current`, `routeContext.current` - Get the current path
- `Route.params`, `routeContext.params` - Get the current parameters
- `Route.set(url, opts?).then(...)` - Set the current route using the router's parent's implicit prefix
    - `opts.data` - The data you want to interpolate the path with
    - `opts.params` - The data you want to append as query parameters
    - `opts.replace` - Whether to replace the current history state
    - `opts.state` - The state to associate with the history entry
    - `opts.title` - The title of the history entry
    - `opts.context` - The router context to use
- `m(Route.Link, {...})` - Create a link using the router's parent's implicit prefix
    - `href:` - The path to route to (required)
    - `tag:` - The tag name to render as the vnode
    - `data:`, `params:`, `replace:`, `state:`, `title:`, `context:` - Options passed through to `Route.set`
    - `attrs:` - Other attributes to set on the element itself
    - Unknown attributes (excluding `key`) are sent through to the underlying node unmodified
- The original proposal was one of the few bits that was almost spot on: https://github.com/MithrilJS/mithril.js/issues/2281
    - I just want to keep the URL handling changes of https://github.com/MithrilJS/mithril.js/pull/2361 in this.

## Request API

This is exposed under `mithril/request`.

- JSONP support is gone. It's basically obsolete now in light of CORS being available on all supported platforms, and our code is easy to just copy if necessary.

Beyond that, the API is probably fine as-is.

## Async API

This is exposed under `mithril/async`.

Basically https://github.com/MithrilJS/mithril.js/issues/2282, implemented at https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/async.js
