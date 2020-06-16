[*Up*](README.md)

# Static renderer

This is exposed under `mithril/static`.

- `result = renderHTML(vnode, options?)` - Render `vnode` to HTML.
    - This does *not* set `info.document`, `info.window`, and `info.root`, and portals are not rendered.

- `result = renderPage(vnode, options?)` - Render `vnode` to an HTML page.
    - This prefixes the output with `<!DOCTYPE html>`.
    - This sets `info.document.documentElement`, `info.document.head`, `info.document.body`, `info.window`, and `info.root` to special sentinel values so you can use those as appropriate, portal processing recognizes them so it can just do the right thing. It ignores all other values, however.
    - This sets `data-mithril-ssr` on children "rendered" to the above nodes.
    - It's recommended to render a few `m("script", {src: ...})` if you plan to rehydrate the rendered result.

- Note: `info.renderType()` in components rendered by each of these methods returns `"static"`.

It's basically `mithril-node-render`, moved into core with appropriate alterations. The HTML strings are rendered in accordance with the WHATWG HTML Living Standard, not any prior HTML spec, and they do reject invalid node types

### Elements

All tags are validated to be proper HTML tag names, and an error is thrown if they aren't.

This doesn't try to render any children of void elements. So if you're relying on `m("input", [m(SomeComponent)])` to work, it won't.

### Custom vnodes

There's one special vnode type specific to this renderer:

- `m("!doctype ...")` - Add a doctype
    - `m("!doctype html")` - Renders to `<!DOCTYPE html>`
    - `m("!doctype foo bar baz")` - Renders to `<!DOCTYPE foo bar baz>`.
    - This is only usable in `renderPage`, but can be used in both custom components and regular components.
    - Note: this is not in of itself enough to switch to XML-compatible HTML rendering - you have to set `options.xhtml` to `true` as well.

All other tag types that don't start with punctuation are validated to be proper HTML tag names, and an error is thrown if they aren't.

Optionally, I might also expose a streaming interface so it can be incrementally written to the stream as it becomes ready for it, for very streamlined server-side rendering support.

### Void elements

This doesn't try to render any children of void elements. So if you're relying on `m("input", [m(SomeComponent)])` to work, it won't.

### Raw HTML

This is able to read HTML from `innerHTML`, and it would inject it unescaped, only escaping enough such that text doesn't erroneously escape the parent element. This would [parse out the HTML fragment per spec](https://html.spec.whatwg.org/multipage/parsing.html#parsing-html-fragments) and escape characters as necessary to ensure it does not escape its parent element. (I would later want to factor this out into a separate module and declare a dependency on it, as *many* other libraries and frameworks would appreciate it, including React's server-side renderer.)

Functionally, it'd be equivalent to executing this in the browser in a vanilla context, but without the related network scheduling (for images, stylesheets, and such):

```js
function sanitize(str, parentTag) {
    let elem = document.createElement(parentTag)
    elem.innerHTML = str
    return elem.innerHTML
}
```

### Why?

1. It's a very common renderer that has to know a lot about Mithril's internals to begin with.
1. It shares a lot in common with hydration, so they both need to be at least somewhat aware of each others' existence.
1. It lets us keep API changes much more tightly integrated.
1. It helps us determine more easily what's common between single-shot and retained renderers, so we can know what abstractions to expose.
1. It makes our SSR support much more discoverable.
1. It's a much simpler upgrading story.

### Future

There's a couple things in the future that might be supported, including:

- A streaming variant so it can be incrementally written to the stream as it becomes ready for it, for very streamlined server-side rendering support. This would also be compatible with backpressure, to minimize buffering, and the stream would be encoded in UTF-8. It would also be made high-performance and memory-optimized to allow for server-side usage, to enable efficient variants of Next.js. (I'm pretty sure people wouldn't mind fronting server-side components.)
- XML and XHTML support, so it can be more broadly used in legacy areas and non-web areas. This would entail a lot of changes to the raw HTML parsing, and much of the validation and special casing around elements would have to be disabled for pure XML.
