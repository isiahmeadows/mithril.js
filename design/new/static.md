[*Up*](README.md)

# Static renderer

This is exposed under `mithril/static`.

- `renderStatic(vnode, {type = "html", window = global window} = {})` - Render `vnode` to a string.
    - `type: "html"` (default) - Render to HTML.
    - `type: "xhtml"` - Render to XML-compatible HTML.
    - `type: "xml"` - Render to XML.
    - `type: "text"` - Render to text, ignoring tag names.
    - `window:` - Specify a global `window` to use. By default, it tries to read the global `window` and falls back on `undefined` if it can't detect one. It's only used for certain context methods.

It's basically `mithril-node-render`, moved into core with appropriate alterations. The HTML strings are rendered in accordance with the WHATWG HTML Living Standard, not any prior HTML spec, and they do reject invalid node types.

### Custom vnodes

There's several special vnode types specific to this renderer:

- `m("?foo", attrs?, [...children])`, `m("?foo", attrs?, ...children)` - Add a processing instruction with various attributes or children.
    - `m("?xml", {version: "1.0", encoding: "utf-8", standalone: "yes"})` - Renders to `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>`
    - `m("?php", "echo $foo;", "echo $bar;")` - Renders to `<?php echo $foo;echo $bar; ?>`
    - `m("?", "echo $foo;", "echo $bar;")` - Renders to `<? echo $foo;echo $bar; ?>`
    - `m("?=", "$this", "->foo")` - Renders to `<?= $this->foo ?>`

- `m('!doctype ...')` - Add a doctype
    - `m("!doctype html")` - Renders to `<!DOCTYPE html>`
    - `m("!doctype foo bar baz")` - Renders to `<!DOCTYPE foo bar baz>`.

- `m("!trust", ...)` - Inject unescaped, trusted source text specified in the children.

All other tag types that don't start with punctuation are passed through unmodified as trusted.

Optionally, I might also expose a streaming interface so it can be incrementally written to the stream as it becomes ready for it, for very streamlined server-side rendering support.

### Void elements

In HTML rendering mode, this doesn't try to render any children of void elements. So if you're relying on `m("input", [m(SomeComponent)])` to work, it won't.

### Component controllers

There's a couple specific values set on component controllers as required, documented here.

- `ctrl.isStatic()` returns `true`, as it's rendering to a static string.

- `ctrl.renderType()` returns `"static"`

### Why?

1. It's a very common renderer that has to know a lot about Mithril's internals to begin with.
1. It shares a lot in common with hydration, so they both need to be at least somewhat aware of each others' existence.
1. It lets us keep API changes much more tightly integrated.
1. It helps us determine more easily what's common between single-shot and retained renderers, so we can know what abstractions to expose.
1. It makes our SSR support much more discoverable.
1. It's a much simpler upgrading story.
