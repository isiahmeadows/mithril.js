[*Up*](README.md)

# Migration

There is a built-in standard library module to assist in migrating from the previous version. It does *not* provide a perfect runtime representation, but it does provide a good enough shim to make migration fairly straightforward. It is exposed via `mithril/migrate`.

- `m(...)`/`m.fragment(...)`/`m.trust(...)` - Old-style hyperscript API, returns migration-ready intermediate nodes and migrates children implicitly to the old format.
    - `m(tag, attrs?, ...children)` - Create component or element
    - `m.fragment(attrs?, ...children)` - Create fragment
    - `m.trust(text)` - Create trusted string
- `migrateOldTree(child)` - Convert an old-style tree to a new-style tree
- `migrateNewTree(child)` - Convert a new-style tree to an old-style tree
- `migrateComponent(Comp)` - Convert an old-style component to a new-style component, including converting the old-style tree to a new-style tree and converting the children input from the new-style format to the old-style format
    - Caveat: `vnode.dom` is only populated for element vnodes and component instances whose top-level value are those.
    - Caveat: lifecycle hooks are *not* implemented for components.

The API is simple - the complexity is saved for the internals. The goal is that, for most cases, you should only need one version of Mithril installed.

Note that this migration utility only supports the previous major revision, no earlier.
