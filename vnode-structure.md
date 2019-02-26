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

If you're confused about all the various bit hacks here and they all look like some alien language, check out [this page](bitwise.md) for a brief overview. It's not too complicated, I promise!

## Hyperscript vnode structure

6 fields:

- `vnode.mask` - Inline cache mask
	- `vnode.mask & 0x00FF` - Type ID
	- `vnode.mask & 0x0100` - Custom element (either autonomous or customized)
	- `vnode.mask & 0x0200` - Not void
	- `vnode.mask & 0x0400` - Has `key`
	- `vnode.mask & 0x0800` - Has `ref`
	- `vnode.mask & 0x1000` - Is known empty (either void or special)
	- `vnode.mask & 0x2000` - Is known single
	- `vnode.mask & 0x4000` - Reserved
	- `vnode.mask & 0x8000` - Reserved
	- `vnode.mask >>> 16` - Node length for raw node reference vnodes
- `vnode.tag` - Tag/custom element name/component name/portal token
- `vnode.attrs` - Resolved attributes, portal value/default
- `vnode.children` - Children/element reference, portal callback
- `vnode.key` - `attrs.key` mirror
- `vnode.ref` - `attrs.ref` mirror

Notes:

- An error is thrown if `vnode.attrs.children.length > 2 ** 16`
- Holes are represented by `null`s
- This resolves the polymorphic `children`, `key`, and `ref` accesses immediately.
- For customized builtins, `vnode.tag` is set to `vnode.attrs.is`. This is the only case where a vnode property is set to an attribute.
- A `m.vnode.create(mask, tag, attrs, children, key, ref)` exists to create this structure, but `m` is preferred when `tag` is dynamic.
- For empty arrays, always return `null`/`undefined` for their children
- Portal tokens are either objects or arrays.

## Mithril IR structure

10 fields:

- `ir.mask` - Inline cache mask
	- `ir.mask & 0x00FF` - Type ID
	- `ir.mask & 0x0100` - Custom element (either autonomous or customized)
	- `ir.mask & 0x0200` - Not void
	- `ir.mask & 0x0400` - Check key
	- `ir.mask & 0x0800` - Skip for diff (i.e. is being asynchronously removed)
	- `ir.mask & 0x1000` - Is reducer
	- `ir.mask & 0x2000` - Has `onremove` on self or descendant
	    - This flag is reset on every element after checking, and is re-toggled if it still has one added
		- This flag is unset on parents with no subscribed children after checking
	- `ir.mask & 0x4000` - Reserved
	- `ir.mask & 0x8000` - Is being rendered
	- `ir.mask >>> 16` - Fragment size
- `ir.id` - Element ID, used for simplifying update batching
- `ir.key` - Element key
- `ir.dom` - Fragment start
- `ir.remove` - `ref` removal hook
- `ir.parent` - Closest element parent
- `ir.children` - Type-specific:
	- Fragment, portal setter, and DOM vnodes: children with holes represented by `null`s
	- Component and portal getter vnodes: the rendered instance as an `ir` object
- `ir.tag` - Type-specific:
	- Component vnode: Component reference
	- Portal getter and portal setter vnodes: Portal ID token
	- DOM vnode with `(vnode.mask & 0x00FF) === 9`: Custom element tag name
	- DOM vnode with `(vnode.mask & 0x0100) !== 0`: Custom element `is` name
	- All other types: `undefined`
- `ir.state` - Type-specific:
	- Component: Current state or view factory
	- Keyed fragment vnode: Fragment key/index map
	- Text or trusted vnode: Fragment key/index map
	- DOM vnode: Element attributes
	- All other types: `undefined`
- `ir.events` - Type-specific:
	- DOM vnode: optional event target + subscribed events
	- All other types: `undefined`

Notes:

- In the MVP, this can just normalize the vnodes into internal IR, replacing them as necessary. This is all just internal whatnot.

## Context

Context instance:

- `context.fields` - Direct reference to fields object
- `context._ir` - Direct reference to component vnode IR

Subtree instance:

- `subtree._ir` - Direct reference to backing IR node

Notes:

- Subtrees are meant to be able to operate without a current `context` instance.
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
	- If the incoming vnode is a `m(Retain)` vnode, skip.
- If `(ir.mask & 0x07FF) !== (vnode.mask & 0x07FF)`, replace.
	- If the incoming vnode's tag type doesn't match the internal vnode's tag type, replace.
	- If the incoming vnode has a key and the internal vnode doesn't, replace.
	- If the internal vnode has a key and the incoming vnode doesn't, replace.
- If `(ir.mask & 0x00FA) === 0x0008 && ir.tag !== vnode.tag`, replace.
	- If the vnodes have tags and the incoming vnode's tag doesn't equal the internal vnode's tag, replace.
	- If the incoming vnode's portal doesn't equal the internal vnode's portal, replace.
- If `(ir.mask & 0x0400) !== 0x0000 && ir.key !== vnode.key`, replace.
	- If the vnodes have keys and the incoming vnode's key doesn't equal the internal vnode's key, replace.
- Else, patch.

## Why keep it JSON-compatible?

This is in large part due to disagreement with [React's decision to block it](https://overreacted.io/why-do-react-elements-have-typeof-property/) somewhat. They make security claims, but I'm not convinced they're serious in any remotely sane set-up:

- They note that it's *very* difficult to block arbitrary JavaScript in general and that their defense could still be penetrated in many circumstances.
- Some of the potential vulnerabilities they claim exist are almost certainly *not* exploitable in practice.
	- The section on "[...] if your server has a hole that lets the user store an arbitrary JSON object while the client code expects a string, [...]" is itself fairly niche, and even in this case, you almost always do further processing before rendering the value.
