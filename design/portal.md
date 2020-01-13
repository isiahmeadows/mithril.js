[*Up*](./README.md)

# Portals

This is exposed under `mithril/portal` and exported from the full bundle as `Mithril.portal`.

- `portal(target, ...children)` - Create a portal to `target` and render `children` to it
    - `target` is a ref (as received by the callback of `m.capture()`).
    - `children` are the children to render.

### Why?

React has portals natively built-in and it allows things like [React Helmet](https://github.com/nfl/react-helmet) to exist. Svelte lets you manually set things on `window` and `head`, including listening to events on the former. It's an uncommon but occasional question within Mithril's chat room how to replicate that within Mithril. This offers a simple solution to the problem, one that makes it easy and simple to render to other objects as necessary. [Also, the component DSL features a built-in hook for this, as it's even more common there and is often needed even outside the standard tree.](component-dsl.md#render-state) (Within the hooks world in React, most `useEffect` blocks are doing one of three things: either fetching resources, adding/removing event listeners, or integrating with a third-party library.)
