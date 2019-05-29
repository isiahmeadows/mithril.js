[*Up*](README.md)

# Vnode renderer

This is exposed under `mithril/render-vnode`.

- `renderVnode(vnode, {retainEventHandlers = false} = {})` - This renders a vnode with potential components and similar to a resolved vnode tree without those components.
	- Fragments are always normalized to objects
	- Numbers and similar are normalized to strings
	- Booleans and `null` are normalized to `undefined`
	- Components are replaced with their contents
	- Control vnodes are replaced with their synchronously rendered tree as applicable
	- DOM event handlers are replaced with a single shared global function unless `retainEventHandlers` is truthy
	- Everything else is as you would expect

### Why?

It's a very common need for testing purposes. It also carries a similar benefit `mithril/render-html` does for figuring out what needs exposed for renderers.
