[*Up*](README.md)

# DOM renderer API

This is mostly the existing renderer API, but with some modifications. It's exposed via `mithril/dom`.

- `promiseToClose = mount(root, init, scheduler?, appRoot = root)` - Render with a root element, a vnode factory, and an optional scheduler. This is exposed in the core bundle via `Mithril.render`.
    - `vnode = init(info)` is a function that takes the `info` object from components and returns a vnode to render. It's invoked synchronously to render the initial tree.
    - `scheduler(f)` is called to batch redraws, where it returns a promise resolved when ready to update. It is not called synchronously - the algorithm just loops around instead.
    - By default, the scheduler is `(f) => { root.ownerDocument.defaultView.requestAnimationFrame(f) }`. This way, it works even when no global DOM is present and it just receives a JSDOM node or something similar, and it's reasonably easy to manage.
    - `appRoot` is used for `info.root`, and is just `root` by default.
    - This is synchronous - it only makes sense to do it this way.
    - This sets an expando `root._ir` to carry all the relevant internal info for each live root, and similar is done with inner portals.
    - This performs `root.setAttribute("data-mithril-root", "")` so Mithril roots can be detected on a page via `document.querySelectorAll("[data-mithril-root]")`, for possible future developer tools and similar for easier detection. It's not otherwise used, and unlike React, it doesn't actually assign any semantics to it internally.
    - This returns a promise that resolves once it's fully committed to the DOM, with a `promise = clear()` callback that clears the root, releases any relevant resources, and returns a promise that resolves once it's fully committed to the DOM. (This is always async, but the precise timing is an implementation detail and it could occur later in the same microtask.)
        - If no more roots exist, this removes the `data-mithril-root` attribute added above and sets `root._ir` to `undefined`.
    - Note that focus is *not* restored like it is with v1/v2.

- `promiseToClose = hydrate(root, init, scheduler?, appRoot = root)` - Hydrates a vnode to a root. This is exposed in the full bundle via `Mithril.hydrate`, but is *not* exposed in the core bundle. (It's tree-shaken out.)
    - Works similarly to `mount`, including setting `root._ir` and `data-mithril-root`.
    - For elements statically rendered via `m(info.document.head, ...)` and `m(info.document.body, ...)`, they will need annotated with a `data-mithril-ssr` attribute to be properly detected.
    - `appRoot` is used for `info.root`, and is just `root` by default.
    - An error is thrown if `root._ir` already exists.
    - An error is thrown if any differences exist between the existing DOM tree the incoming vnode tree, except for text nodes, attributes, and parents missing all their children.
    - If an error is thrown at any point, all successfully added removal hooks are called immediately before throwing the caught error. If any of these throw, their errors replace the initially caught error and are rethrown instead.
    - This shares a lot of code with `mount`, hence why they're in the same module.
    - Note: this must *not* be called more than once, unlike with `mount` above (which may be called multiple times)

- `promise = close()` - Clear a root.
    - This returns a promise that resolves once it's fully committed to the DOM.
    - If no more roots exist, this removes the `data-mithril-root` attribute added above and sets `root._ir` to `undefined`.

### Void elements

This doesn't try to render any children of void elements. So if you're relying on `m("input", [m(SomeComponent)])` to work, it won't.

### Component controllers

There's several values set on component controllers aside from the ones required to be present.

- `info.renderType()` returns `"dom"`

- `info.document` - Returns the detected `document` for this context. If you're using JSDOM to test, use this to get your `fetch` if you're creating new instances each time. This is read via `root.ownerDocument` and will always be present. 99% of the time, it'll be the corresponding global, but that 1% of the time is useful for testing and such.

- `info.window` - Returns the detected window for this context. If you're using JSDOM to test, use this to get your `fetch` if you're creating new instances each time. This is read via `root.ownerDocument.defaultView` and will always be present. 99% of the time, it'll be the corresponding global, but that 1% of the time is useful for testing and such.

- `info.root` - Returns a reference to the root rendered to.

### Notes

- In dev mode, this keeps a component stack to help more informatively display errors to the user, since the stack trace won't exist.

- Trusted vnodes are *not* supported by this renderer. It's complicated, error-prone, among other things, and in general, 99% of use cases are handled already by `innerHTML`. If you really need anything more complicated than that, use a ref and do `insertAdjacentHTML` yourself.

- This module pulls its document from `root.ownerDocument` and relies on zero globals other than that required per the [ECMAScript spec](https://tc39.es/ecma262). This ensures trivial compatibility with JSDOM with no polyfill needed unless you need it yourself.
    - Stuff is cached relative to the node itself and stored in the `_ir` as appropriate, not globally.
    - This makes this *exceedingly* easy to test and use.

- For both `render` and `hydrate`, the `root` can be either an element reference or a string selector to plug into `document.querySelector(root)` to get the expected root reference.
    - This is *not* a standard vnode tag selector, but an actual CSS selector. It is *not* used to modify the node, only to locate it.

- First renders are always synchronous. Subsequent renders await async unmounting before rendering subtrees. (This avoids certain async complications.)

- If any subtree redraws are scheduled, they are cleared to make room for the global redraw.

- Callbacks are deduplicated via `schedule` on update, requesting a time slot to update the DOM tree before committing. This is intentionally coupled to the renderer as it has some non-trivial deduplication logic to ensure trees get merged with their ancestors when their updates get scheduled.

### Why allow rendering just attributes to be specified inline?

It makes it much easier in several circumstances to just sprinkle in a little bit of Mithril onto a page, since you could just render some attributes. It also makes a few things like portals a little easier to come by.

And from a code standpoint, it's not hard - it's as easy as just moving the internal entry point from a retained unkeyed fragment to a retained unkeyed element.
