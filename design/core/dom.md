[*Up*](README.md)

# DOM renderer API

This is mostly the existing renderer API, but with some modifications. It's exposed via `mithril/dom`.

- `render(root, child)` - Render a tree and optional attributes to a root. This is exposed in the core bundle via `Mithril.render`.
	- If `root` is currently being redrawn, an error is thrown.
	- `child` is normalized as if via `m("tag", attrs).attrs` and the result rendered as an attributes object.
	- This is synchronous - it only makes sense to do it this way.
	- This assigns an expando `._ir` to the root if one doesn't exist already.

- `render(root)` - Clear a root.

- `hydrate(root, child)` - Hydrates a tree to a root. This is exposed in the full bundle via `Mithril.hydrate`, but is *not* exposed in the core bundle. (It's tree-shaken out.)
	- `child` is normalized as if via `m("tag", attrs).attrs`.
	- If `root` is currently being redrawn, an error is thrown.
	- This is synchronous - it only makes sense to do it this way.
	- This assigns an expando `._ir` to the root.

- `abortable((signal, o) => ...)` - Invokes a callback with an abort signal (ponyfilled with something good enough to work with `mithril/request` if necessary) that's called on `done` and ignores the return value (useful if it's a simple async arrow function). This returns a stream and is useful with `fetch` and `mithril/request` for cleaning up requests, and it's a pretty simple utility.
	- If the returned promise errors, this invokes `o.error(e)` with the thrown/rejected error.

Notes:

- For both `render` and `hydrate`, the `root` can be either an element reference or a string selector to plug into `document.querySelector(root)` to get the expected root reference.
	- This is *not* a standard vnode tag selector, but an actual CSS selector. It is *not* used to modify the node, only to locate it.

- For `render`:
	- First renders are always synchronous. Subsequent renders await async unmounting before rendering subtrees. (This avoids certain async complications.)
	- If any subtree redraws are scheduled, they are cleared to make room for the global redraw.
	- This depends on `window` and `document` globals - those are *not* dependency-injected. This does *not* include module instantiation, so it's safe to load without side effects on server-side.
	- Callbacks are deduplicated via `requestAnimationFrame` on update, requesting a time slot to update the DOM tree before committing. This is intentionally coupled to the renderer as it has some non-trivial deduplication logic to ensure trees get merged with their ancestors when their updates get scheduled.

- For `hydrate`:
	- An error is thrown if `root._ir` already exists.
	- An error is thrown if any differences exist between the existing DOM tree the incoming vnode tree.
	- If an error is thrown at any point, all successfully added removal hooks are called immediately before throwing the caught error. If any of these throw, their errors replace the initially caught error and are rethrown instead.
	- This shares a lot of code with `render`, hence why they're in the same module.

- For `abortable`:
	- This only exists here instead of `mithril/m` because it relies on certain DOM checks, and I'd rather keep everything in core with explicit DOM dependencies constrained to `mithril/dom` for architectural reasons, including easier usage with Node.
	- On many other platforms, it's more appropriate to do something else. For instance, a renderer running on .NET natively should provide a similar implementation exposing a genuine `System.Threading.CancellationToken` object or a wrapper thereof. Also, Java cancellation doesn't directly notify.

### Why allow rendering just attributes to be specified inline?

It makes it much easier in several circumstances to just sprinkle in a little bit of Mithril onto a page, since you could just render some attributes. It also makes a few things like portals a little easier to come by.

And from a code standpoint, it's not hard - it's as easy as just moving the internal entry point from a retained unkeyed fragment to a retained unkeyed element.
