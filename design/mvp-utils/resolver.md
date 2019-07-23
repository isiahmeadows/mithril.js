[*Up*](README.md)

# Resolver renderer

This is exposed under `mithril/resolver`.

- `resolver = makeResolver((attrs) => vnode, {retainEventHandlers = false} = {})` - This resolves a vnode facotry to a stream of resolved vnode trees with all child components inlined.
	- `resolver.update(attrs)` - Update the factory with new attributes.
	- `resolver.resolved` - A stream of resolved vnode trees with all components inlined.
	- Fragments are always normalized to objects.
	- Numbers and similar are normalized to strings.
	- Booleans and `null` are normalized to `undefined`.
	- Components are replaced with their contents.
	- Control vnodes are replaced with their synchronously rendered tree as applicable.
	- DOM event handlers are removed unless `retainEventHandlers` is truthy.
	- Everything else is as you would expect.
	- Lifecycles and similar *are* tracked appropriately.

### Metadata

The metadata is [the same as in the string renderer](string.md#context), except `meta.type` is set to `"resolver"`.

### Custom vnodes

All element vnodes are retained literally.

### Why?

It's a very common need for testing purposes. It also carries a similar benefit the [string renderer](string.md) does for figuring out what needs exposed for renderers.
