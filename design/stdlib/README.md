[*Up*](../README.md)

# Standard Library

There will be a standard library of common utilities and related. Most of these are to some degree platform-specific, but not all of them. And they all serve much more specialized uses. None of these are included in the core build, but many of them are included in the full build. They are all included in the npm download, however.

- [Component DSL: `mithril/component`](component.md)
- [Routing: `mithril/route`](route.md)
- [Path templates: `mithril/path`](path.md)
- [Resource fetching: `mithril/request`](request.md)
- [Lazy loading: `mithril/lazy`](lazy.md)
- [Static renderer: `mithril/static`](static.md)
- [Resource loading: `mithril/use`](use.md)
- [Virtual scrolling: `mithril/virtual`](virtual.md)
- [Modal dialog: `mithril/modal`](modal.md)
- [Carousel: `mithril/carousel`](carousel.md)
- [Tree introspection for the DOM renderer: `mithril/dom-inspect`](dom-inspect.md)
- [Migration from v2: `mithril/migrate`](migrate.md)

Note that some of them (like `virtual`) feature their own class.

There are [future utilities I'm considering that are not part of the MVP](future.md) as well, but I have not decided they merit inclusion yet. As for deprecated v1/v2 stuff, [I do have plans for those, too](legacy.md).
