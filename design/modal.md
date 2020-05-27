[*Up*](README.md)

# Modal API

This is exposed under `mithril/modal`, and helps users create accesssible modals.

- `overlay({on: {close}, target?, setAriaHiddenAttrs = true, ...attrs}, overlay)` - Render a modal overlay
    - `target` is the target to render to, by default `info.document.body`.
    - For accessibility reasons, this sets `"aria-hidden": "true"` on the render root unless `setAriaHiddenAttrs` is explicitly set to `false`, and it similarly sets `"aria-hidden": "false"` on `target` unless that attribute is already present on remaining attributes.
        - The long name is to make it *abundantly clear* that you really, *really*, ***really*** should not be doing this unless you absolutely have to.
    - This is mostly thin sugar over `m(target, attrs, overlay)` with a name that better represents the intent. It includes a couple additions to simplify modals, but that's about it.
        - It adds a handler for `keydown` to capture `Esc` key presses, wrapping any existing one as appropriate.
        - It adds a `click` handler to the overlay to capture direct clicks, wrapping any existing one as appropriate.
        - The synthetic `close` event is emitted with an object `e` where:
            - `e.kind: "esc" | "clickOut" | "close"` - The kind of event, in case you want to ignore escapes, clicks to the overlay, or both.
            - `e.original` - The original DOM event, in case you want further detail into the event itself.
            - Though *strongly* not recommended for accessibility reasons, you don't have to actually close the modal on escape or overlay click - you can do `if (e.kind === "esc") return` or similar.
        - It exposes a `"mithril/modal:close"({kind, original})` callback to the environment to be received by `modal` to connect modal closure to the close callback as appropriate. The object is passed through unmodified to the `close` event handler.
    - Top-level children represent the overlay, and inner children of it represent the modal's contents
    - Children represent additional attributes for the overlay itself, and they may contain one or more elements for the modal itself.
    - Pass `m.state((info) => info.whenReady(func))` to observe when the modal is first shown.
    - Pass `m.state((info) => info.whenRemoved(func))` to observe when the modal is removed.
    - On remove, this always restores the previously active focused element if one was previously active.
    - Stacked modals are supported.
    - You can render classes and attributes as desired to signify the modal is open.
    - In advanced cases where the overlay consists of multiple stacked elements or the target is anything other than `document.body`, you could pretty easily roll this yourself.
- `modal({layout, title, content, close})` - Render a modal element
    - `layout({title, content, close})` - Render the layout of the modal. Each property corresponds to the given property. This must return a DOM vnode, as extra accessibility attributes are tacked on. By default, this just returns `m("div.modal", {}, title, content, close)`.
    - `title` is the modal's title. This must be a DOM vnode, as accessibility attributes are set on it.
    - `content` is the modal's content. This must be a DOM vnode, as accessibility attributes are set on it.
    - `close` is the modal's close button. This must be a DOM vnode, as a click handler is set on it. It's also focused on load.
    - This uses the `mithril/modal:close` key as explained above to observe clicks to the close button.

A lot of the more advanced configuration can be done directly:

- To hide the modal (like on close), simply don't render the element.
- To set a close transition, use a `transition(...)` in the modal child element - that blocks closure as necessary so the transition can run, and it blocks even the parent overlay from going away.
    - You can set this both on the overlay *and* the inner modal box.

### Why?

1. Modals are a rather common thing to want to add.
1. Modal accessibility is *hard* to get right. It's a ton of boilerplate, and most people *won't* add everything they need to to ensure it's properly accesssible.
