[*Up*](./README.md)

# MVP Utilities

These are all various utilities that are, unless otherwise listed, kept out of the core bundle, but they are part of the MVP of this proposal.

## Vnode inspection Utilities

This is exposed under `mithril/vnodes` and in the core bundle via `Mithril.Vnodes`.

- `Vnodes.tag(vnode)` - Get the resolved tag name, component reference, or built-in component reference.
- `Vnodes.attrs(vnode)` - Get the resolved attributes as a frozen object, including `is` for DOM `is` attributes, `key` for the key, `ref` for the ref, and `children` for the resolved children.
- `Vnodes.children(vnode)` - Get the resolved children as a frozen array.

### Why?

Given that [vnode allocation and inspection now requires interpretation](vnode-structure.md), there needs to be some standard library functions for easily inspecting various properties of attributes.

## Composable refs

This is exposed under `mithril/ref` and in the core bundle via `Mithril.Ref`. It exists to help make refs considerably more manageable.

- `refs = Ref.join(({...elems}) => ...)` - Create a combined ref that invokes a callback once all named refs are received.
    - `ref = refs(key)` - Create and get a ref linked to that callback key
    - `ref = refs(Ref.ROOT)` - Create and get a ref called to send an object, or `undefined` if named refs exist.
    - `value = refs()` - Get the resolved values or `undefined` if some are still pending

- `refs = Ref.all(([...elems]) => ...)` - Create a combined ref that invokes a callback once all named refs are received.
    - `ref = refs(index)` - Create and get a ref linked to that index
    - `ref = refs(Ref.ROOT)` - Get a ref called to send an empty array, or `undefined` if named refs exist.
    - `value = refs()` - Get the resolved values or `undefined` if some are still pending

Notes:

- The resulting refs only propagate the first argument, the element or component ref.
- These don't type check the values themselves apart from checking identity with a private sentinel object.

This is implemented [here](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/ref.mjs).

## Router API

This is exposed under `mithril/router`.

- `m(Router.Router, {prefix, default, history, onredirect, ...routes})` - Define routes
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
- `m(Router.Redirect, {...})` - Redirect to another route.
    - This simply does `history.push({...attrs, replace: true})` on initialization.
    - This can be returned even when the route itself was previously rendered.
- `m(Router.Link, {...})` - Create a link using the router's parent's implicit prefix
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
    - This is intentionally unwieldy. Prefer `Router.Link` where possible.
    - Each of these strips the prefix as necessary, and they wrap inconsistencies in the history passed to `Router.Router`.
- The original proposal was one of the few bits that was fairly close: https://github.com/MithrilJS/mithril.js/issues/2281
    - I just want to keep the URL handling changes of https://github.com/MithrilJS/mithril.js/pull/2361 in this.
    - I also wanted to discourage direct manipulation.

This is implemented [here](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/router.mjs).

## Request API

This is exposed under `mithril/request`.

- JSONP support is gone. It's basically obsolete now in light of CORS being available on all supported platforms, and our code is easy to just copy if necessary.

Beyond that, the API is probably fine as-is.

## Async loading sugar

This is exposed under `mithril/async`.

Basically https://github.com/MithrilJS/mithril.js/issues/2282.

- `m(Async, {init, destroy, body})`
    - `init:` - Initialize the resource and return a promise resolved once ready, rejected if error. This is a function accepting a cancellation scheduler so you can abort requests as necessary.
    - `destroy:` - Destroy an initialized resource and return a promise resolved once destroyed, rejected if an error occurred during destruction.
    - `body:` - Render a body based on the state
        - `body("loading")` - Resource is currently loading
        - `body("ready", data)` - Resource is ready
        - `body("error", error)` - An error occurred when creating or destroying the resource.
        - `body("destroyed")` - Resource is successfully destroyed
    - `ref:` - This provides a `destroy()` callback as its `ref`, so you can manually and gracefully destroy the resource.

This is implemented [here](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/async.mjs).

### Why?

1. It makes lazy resource loading *way* easier to manage.
1. It takes all the boilerplate out of CRUD-like views.
1. It enables something like [`React.lazy`](https://reactjs.org/docs/code-splitting.html#reactlazy) + [`React.Suspense`](https://reactjs.org/docs/code-splitting.html#suspense), but it's generalized and makes error handling a bit easier.
1. Together with `Router` above, async route loading is practically trivial.
1. One might conceptualize a component + server-side helper built on this + `mithril/hydrate` + `mithril/render-html` to create delimited components that incrementally load from the server as needed, with implicit HTML hydration to speed it up significantly. With React, it's *possible* to build something through mixing `React.lazy` + `React.suspense`, but it's not something you could just put together in a weekend on your own.

## Transition API

This is exposed under `mithril/transition`.

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

This is exposed under `mithril/stream`, and is the same as what's there today. Nothing is changing here except [maybe moving it into the main bundle itself](https://github.com/MithrilJS/mithril.js/issues/2380), but that's separate to this whole effort.
