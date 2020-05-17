[*Up*](README.md)

# Static renderer

This is exposed under `mithril/static`.

- `promise = renderHTML(vnode, options?)` - Render `vnode` to an HTML string.
    - `options.xhtml` is whether to emit XML-compatible HTML or not. Default is not to.
    - `options.window` is the global `window` to use. By default, it tries to read the global `window` and falls back on `undefined` if it can't detect one. It's only used for certain context methods.
    - `options.signal` is an [abort signal](signal.md), in case it ever needs to cancel.
    - This does *not* set `info.document`, `info.window`, and `info.root`, and portals are not rendered.
    - `promise` is a promise to the rendered result string.

- `promise = renderPage(vnode, options?)` - Render `vnode` to an HTML string.
    - `options.xhtml` is whether to emit XML-compatible HTML or not. Default is not to.
    - `options.window` is the global `window` to use. By default, it tries to read the global `window` and falls back on `undefined` if it can't detect one. It's only used for certain context methods.
    - `options.signal` is an [abort signal](signal.md), in case it ever needs to cancel.
    - This sets `info.document.documentElement`, `info.document.head`, `info.document.body`, `info.window`, and `info.root` to special sentinel values so you can use those as appropriate, portal processing recognizes them so it can just do the right thing. It ignores all other values, however.
    - This sets `data-mithril-ssr` on children "rendered" to the above nodes.
    - `promise` is a promise to the rendered result string.

- `promise = renderText(vnode, options?)` - Render `vnode` to a text string.
    - `options.window` is the global `window` to use. By default, it tries to read the global `window` and falls back on `undefined` if it can't detect one. It's only used for certain context methods.
    - `options.signal` is an [abort signal](signal.md), in case it ever needs to cancel.
    - `promise` is a promise to the resulting text string.

It's basically `mithril-node-render`, moved into core with appropriate alterations. The HTML strings are rendered in accordance with the WHATWG HTML Living Standard, not any prior HTML spec, and they do reject invalid node types.

### Custom vnodes

There's two special vnode types specific to this renderer:

- `m("!doctype ...")` - Add a doctype
    - `m("!doctype html")` - Renders to `<!DOCTYPE html>`
    - `m("!doctype foo bar baz")` - Renders to `<!DOCTYPE foo bar baz>`.
    - This is only usable in `renderHTMLPage` and can only be rendered statically.

- `m("!trust", ...)` - Inject unescaped, trusted source text specified in the children.

All other tag types that don't start with punctuation are passed through unmodified as trusted.

Optionally, I might also expose a streaming interface so it can be incrementally written to the stream as it becomes ready for it, for very streamlined server-side rendering support.

### Void elements

In HTML rendering mode, this doesn't try to render any children of void elements. So if you're relying on `m("input", [m(SomeComponent)])` to work, it won't.

### Component controllers

There's a couple specific values set on component controllers as required, documented here.

- `info.renderType()` returns `"static"`

### Why?

1. It's a very common renderer that has to know a lot about Mithril's internals to begin with.
1. It shares a lot in common with hydration, so they both need to be at least somewhat aware of each others' existence.
1. It lets us keep API changes much more tightly integrated.
1. It helps us determine more easily what's common between single-shot and retained renderers, so we can know what abstractions to expose.
1. It makes our SSR support much more discoverable.
1. It's a much simpler upgrading story.
