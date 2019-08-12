[*Up*](README.md)

# Vnode accessors

These are exposed via `mithril/vnodes` and as `Mithril.Vnodes` in the full bundle. They exist to make vnode accesses considerably more human-friendly and readable.

- Get tag: `getTag(vnode)` - Returns the tag for element vnodes, the component for component vnodes, `"#text"` for text nodes, `"#fragment"` for fragments, `"#hole"` for holes, `"#replace"` for replace vnodes, and `"#dynamic"` for dynamic vnodes.
- Get attrs: `getAttrs(vnode)` - Returns all attributes, including `children` for children.
- Get single attribute: `getAttr(vnode, key)` - Returns that single attribute's value.
- Prepend children: `prepend(vnode, ...children)` - Returns a new vnode with the same tag as `vnode` and the attributes of `vnode` merged with `attrs` with `attrs` preferred for conflicts.
- Append children: `append(vnode, ...children)` - Returns a new vnode with the same tag as `vnode` and the attributes of `vnode` merged with `attrs` with `attrs` preferred for conflicts.

## Why?

Well, for one, the raw structure is meant for machines, not humans. It's not in core because relatively few users need it.
