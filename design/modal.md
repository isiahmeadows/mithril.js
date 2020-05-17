[*Up*](README.md)

# Modal API

This is exposed under `mithril/modal`.

- `modal(...children)` - Render the modal dialog
    - Set the `mithril/modal:target` context key to set the modal target. By default, this is `info.document.body`, but you can set it in context to change it globally or locally.
    - Top-level `children` represent the overlay, and inner children of it represent the modal's contents
    - Children represent additional attributes for the overlay itself, and they may contain one or more elements for the modal itself.
    - Pass `m.state((_, info) => info.whenReady(func))` to observe when the modal is first shown.
    - Pass `m.state((_, info) => info.whenRemoved(func))` to observe when the modal is removed.
    - On remove, this always restores the previously active focused element if one was previously active.
    - Stacked modals are supported.
- `overlay({on: {click, close}, class?, clickFilter?, closeOnClick?, closeOnEscape?})` - Get common overlay attributes to render.
    - `attrs.class = "mithril-modal--open"` - The class name to set on the modal and modal target.
    - `attrs.clickFilter = e => e.target === e.currentTarget` - The filter to use for clicks. If the overlay consists of multiple stacked elements, you'll need to change this to account for that added structure, but you rarely need to do this otherwise.
    - `attrs.closeOnClick = true` - Whether to emit the close event whenever the overlay itself (not any of its children) is clicked.
    - `attrs.closeOnEscape = true` - Whether to emit the close event when the `Esc` key is hit.
        - This is done by adding a `keydown` handler to `document`.
    - This also sets some basic style attributes like `background-color`, but you can always override these using later attributes in the modal itself.
    - If the overlay consists of multiple stacked elements, you should not use this, but roll it yourself.

A lot of the more advanced configuration can be done directly:

- To hide the modal (like on close), simply don't render the element.
- To show from the accessibility tree, just use `"aria-hidden": "false"` in `attrs.content`.
- To set a close transition, use a `transition(...)` in the modal child element - that blocks closure as necessary so the transition can run, and it blocks even the overlay from going away.
    - You can set this both on the overlay *and* the inner modal box.
