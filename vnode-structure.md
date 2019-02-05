# Vnode strucutre

The structure of vnodes is optimized for a few things:

- Minimal retained memory
	- Intentionally, attributes are *not* retained except for DOM attributes.
	- Likewise, this reuses a lot of fields for multiple purposes.
- Minimal non-numeric checks
	- The complex bit mask for the first field of each exists for this reason.
	- Identity comparison avoids even string comparison where it can, preferring to stick with bit masks for 99% of type checks.
- Fast processing of incoming vnodes
	- Refs are trivial to access.
	- Bit masks on a property are slightly faster to access than an object's child property because the layer of indirection is gone. This doesn't matter in application code, but it certainly does in perf-sensitive code.

## Hyperscript vnode structure

3 fields:

- `vnode.mask` - Inline cache mask
	- `vnode.mask & 0x00FF` - Type ID
	- `vnode.mask & 0x0100` - Custom element (either autonomous or customized)
	- `vnode.mask & 0x0200` - Not void
	- `vnode.mask & 0x0400` - Has `key`
	- `vnode.mask & 0x0800` - Has `ref`
	- `vnode.mask & 0x1000` - Is known empty
	- `vnode.mask & 0x2000` - Is known single
	- `vnode.mask & 0x4000` - Reserved
	- `vnode.mask & 0x8000` - Reserved
- `vnode.tag` - Tag/component name
- `vnode.attrs` - Attributes
- `vnode.children` - Children

Notes:

- An error is thrown if `vnode.attrs.children.length > 2 ** 16`
- Holes are represented by `null`s
- This defers the polymorphic `children`, `key`, and `ref` accesses to the renderer.
- For customized builtins, `vnode.tag` is set to `vnode.attrs.is`. This is the only case where a vnode property is set to an attribute.
- A `m.vnode.create(mask, tag, attrs)` exists to create this structure, but `m` is preferred when `tag` is dynamic.

## Mithril IR structure

8 fields:

- `ir.mask` - Inline cache mask
	- `ir.mask & 0x00FF` - Type ID
	- `ir.mask & 0x0100` - Custom element (either autonomous or customized)
	- `ir.mask & 0x0200` - Not void
	- `ir.mask & 0x0400` - Check key
	- `ir.mask & 0x0800` - Skip for diff (i.e. is being asynchronously removed)
	- `ir.mask & 0x1000` - Is reducer
	- `ir.mask & 0x2000` - Has `onremove` on self or child
	    - This flag is reset on every element after checking, and is re-toggled if it still has one added
	    - This requires a vnode stack.
	- `ir.mask & 0x4000` - Reserved
	- `ir.mask & 0x8000` - Reserved
	- `ir.mask >>> 16` - Fragment size
- `ir.key` - Element key
- `ir.dom` - Fragment start
- `ir.refs` - Linked refs
- `ir.children` - Fragment/element children, component instance
	- Holes in fragment/element children are represented by `null`s
	- These are `ir` objects themselves.
- `ir.tag` - Type-specific:
	- Component vnode: Component reference
	- DOM vnode with `(vnode.mask & 0x00FF) === 9`: Element tag name
	- DOM vnode with `(vnode.mask & 0x0100) !== 0`: Custom element tag name
	- All other types: `undefined`
- `ir.state` - Type-specific:
	- Component: Current state or view factory
	- Keyed fragment vnode: Fragment key/index map
	- Text or trusted vnode: Fragment key/index map
	- DOM vnode: Element attributes
- `ir.hook` - Type-specific:
	- Component: `onremove` hook
	- DOM vnode: event target

Notes:

- The "is static" flag is to allow certain component-related operations dodge subtrees that don't need it.
- In the MVP, this can just use verbose vnodes. This is all just internal whatnot.

## Context

Context instance:

- `context.isInit` - API `context.isInit` as data property
- `context._path` - Path to subtree
- `Context.prototype.update` - API `context.update(next?)`
- `Context.prototype.subtree` - API `context.subtree()`
- `Context.prototype.ref` - API `context.ref(refs?)`

Subtree instance:

- `subtree._path` - Path to subtree
- `Subtree.prototype.update` - API `subtree.update(next?)`
- `Subtree.prototype.updateSync` - API `subtree.updateSync(next?)`

Ref instance:

- `ref._mask` - Inline cache mask:
	- `ref._mask & 0x03` - Ref type:
	    - `0` - Used
	    - `1` - Simple
	    - `2` - Composite
	- `ref._mask & 0x04` - Is live
	- `ref._mask >>> 8` - Number of values remaining before emit
- `ref._listeners` - Type-specific:
	- Used: Remove listeners
	- Simple or composite: Update listeners
- `ref._refs` - Type-specific:
	- Simple: Child composite refs
	- Composite: Parent refs
- `ref._keys` - Type-specific:
	- Simple: Child composite indices
	- Composite: Parent keys
- `ref._value` - The value to eventually emit for a composite ref.
- `Ref.prototype.update` - API `ref.update(callback)`
- `Ref.prototype._emit` - How refs are fired.

Notes:

- Subtrees and refs are meant to be able to operate without a current `context` instance.
- Contexts are mostly just simple dependency injection objects. It's subtrees and refs that do all the interesting work.
- Unused refs never complete. A future development build might choose to check for these and generate warnings.
- After receiving a vnode tree, created refs are marked as live and checked for usage.
	- This step also marks created refs as live.
	- This step also initializes the `ref._value` for composite refs.
	- For unused refs, this marks all of them as used, clears their states, sends `undefined` to child composite refs, and generates a warning for each one.

## Operations

These operations are a little arcane, but that's because it involves quite a bit of bitwise inspection and comparison against the vnode and internal node masks. It's heavily annotated to help others understand what's actually going on here.

### Get patch strategy

- If `(vnode.mask & 0x00FF) === 0x0000`, skip.
	- If the incoming vnode is a `m(retain)` vnode, skip.
- If `(ir.mask & 0x07FF) !== (vnode.mask & 0x07FF)`, replace.
	- If the incoming vnode's tag type doesn't match the internal vnode's tag type, replace.
	- If the incoming vnode has a key and the internal vnode doesn't, replace.
	- If the internal vnode has a key and the incoming vnode doesn't, replace.
- If `(ir.mask & 0x00FE) === 0x0008 && ir.tag !== vnode.tag`, replace.
	- If the vnodes have tags and the incoming vnode's tag doesn't equal the internal vnode's tag, replace.
- If `(ir.mask & 0x0400) !== 0x0000 && ir.key !== vnode.key`, replace.
	- If the vnodes have keys and the incoming vnode's key doesn't equal the internal vnode's key, replace.
- Else, patch.
