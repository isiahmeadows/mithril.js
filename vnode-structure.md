[*Up*](./README.md)

# Vnode and IR structure

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

The vnodes are arranged as objects to allow engines to optimize for a single type map.

Total: 6 fields

- `vnode.mask` - Inline cache mask
	- `vnode.mask & 0x00FF` - Type ID
	- `vnode.mask & 0x0100` - Custom element (either autonomous or customized)
	- `vnode.mask & 0x0200` - Is void, special, or known empty
	- `vnode.mask & 0x0400` - Has `key`
	- `vnode.mask & 0x0800` - Has `ref`
	- `vnode.mask & 0x1000` - Is known single
	- `vnode.mask & 0x2000` - Reserved
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
- For DOM vnodes, attributes are serialized to an array with `is`, `key`, and `ref` removed.
- This resolves the polymorphic `children`, `key`, and `ref` accesses immediately.
- For customized builtins, `vnode.tag` is set to `vnode.attrs.is`. This is the only case where a vnode property is set to an attribute.
- A `Mithril.create(mask, tag, attrs, children, key, ref)` exists to create this structure, but `m` is preferred when `tag` is dynamic.
- For empty arrays, always return `null`/`undefined` for their children
- Portal tokens are either objects or arrays.

## Mithril IR structure

The IR vnodes are arranged as arrays to minimize memory and let them be quickly read without confusing the engine with polymorphic types. Specifically:

- Chrome and Firefox both pre-allocate room in arrays for 8 entries immediately (I've verified this), and I suspect Edge and Safari are likely similar.

Here are the types:

- Text: 7 entries
	- `ir[mask]` - Inline cache mask
	- `ir[id]` - Internal node ID, used for simplifying update batching
	- `ir[key]` - Element key
	- `ir[parent]` - Closest element parent
	- `ir[remove]` - `ref` removal hook
	- `ir[dom]` - Node reference
	- `ir[children]` - Text contents

- Raw: 7 entries
	- `ir[mask]` - Inline cache mask
	- `ir[id]` - Internal node ID, used for simplifying update batching
	- `ir[key]` - Element key
	- `ir[parent]` - Closest element parent
	- `ir[remove]` - `ref` removal hook
	- `ir[dom]` - Node start/reference
	- `ir[children]` - Fragment length (usually 1)

- Keyed: 7 entries
	- `ir[mask]` - Inline cache mask
	- `ir[id]` - Internal node ID, used for simplifying update batching
	- `ir[key]` - Element key
	- `ir[parent]` - Closest element parent
	- `ir[remove]` - `ref` removal hook
	- `ir[children]` - Children with holes represented by `undefined`s
	- `ir[tag]` - Fragment key/index map

- Fragment: 6 entries
	- `ir[mask]` - Inline cache mask
	- `ir[id]` - Internal node ID, used for simplifying update batching
	- `ir[key]` - Element key
	- `ir[parent]` - Closest element parent
	- `ir[remove]` - `ref` removal hook
	- `ir[children]` - Children with holes represented by `undefined`s

- Portal Get: 7 entries
	- `ir[mask]` - Inline cache mask
	- `ir[id]` - Internal node ID, used for simplifying update batching
	- `ir[key]` - Element key
	- `ir[parent]` - Closest element parent
	- `ir[remove]` - `ref` removal hook
	- `ir[children]` - The rendered instance as an `ir` object or `undefined` if no children are rendered
	- `ir[tag]` - Portal ID token

- Portal Set: 7 entries
	- `ir[mask]` - Inline cache mask
	- `ir[id]` - Internal node ID, used for simplifying update batching
	- `ir[key]` - Element key
	- `ir[parent]` - Closest element parent
	- `ir[remove]` - `ref` removal hook
	- `ir[children]` - Children with holes represented by `undefined`s
	- `ir[tag]` - Portal ID token

- Simple DOM: 8 entries
	- `ir[mask]` - Inline cache mask
		- Assert: `(ir[mask] & 0x00FF) !== 9`
		- Assert: `(ir[mask] & 1 << 8) === 0`
		- Assert: `(ir[mask] & 1 << 16) === 0`
	- `ir[id]` - Internal node ID, used for simplifying update batching
	- `ir[key]` - Element key
	- `ir[parent]` - Closest element parent
	- `ir[remove]` - `ref` removal hook
	- `ir[dom]` - Element reference
	- `ir[children]` - Children with holes represented by `undefined`s
	- `ir[tag]` - Current attributes

- Component: 9 entries
	- `ir[mask]` - Inline cache mask
		- `ir[mask] & 1 << 16` - Is reducer
	- `ir[id]` - Internal node ID, used for simplifying update batching
	- `ir[key]` - Element key
	- `ir[parent]` - Closest element parent
	- `ir[remove]` - `ref` removal hook
	- `ir[children]` - The rendered instance as an `ir` object or `undefined` if no children are rendered
	- `ir[tag]` - Component reference
	- `ir[state]` - Current state or view factory
	- `ir[attrs]` - Current attributes

- Full DOM: 10 entries
	- `ir[mask]` - Inline cache mask
		- `ir[mask] & 1 << 16` - Has events
	- `ir[id]` - Internal node ID, used for simplifying update batching
	- `ir[key]` - Element key
	- `ir[parent]` - Closest element parent
	- `ir[remove]` - `ref` removal hook
	- `ir[dom]` - Fragment start
	- `ir[children]` - Children with holes represented by `undefined`s
	- `ir[attrs]` - Current attributes
	- `ir[tag]` - Mask-dependent:
		- `(ir[mask] & 0x00FF) === 9`: Custom element tag name
		- `(ir[mask] & 1 << 8) !== 0`: Custom element `is` name
		- Otherwise: `undefined`
	- `ir[state]` - Event target + subscribed events

Common:

- `ir[mask]` - Inline cache mask
	- `ir[mask] & 0x00FF` - Type ID
	- `ir[mask] & 1 << 8` - Custom element (either autonomous or customized)
	- `ir[mask] & 1 << 9` - Not void
	- `ir[mask] & 1 << 10` - Check key
	- `ir[mask] & 1 << 11` - Skip for diff (i.e. is being asynchronously removed)
	- `ir[mask] & 1 << 12` - Has removal hook on self or descendant
	    - This flag is reset on every element after checking, and is re-toggled if it still has one added
		- This flag is unset on parents with no subscribed children after checking
	- `ir[mask] & 1 << 13` - Has removal hook on self
	- `ir[mask] & 1 << 14` - Is locked (rendered or destroyed)
		- This flag exists mainly for sanity checks to avoid certain issues.
	- `ir[mask] & 1 << 15` - Reserved
	- `ir[mask] & 1 << 16` to `ir[mask] & 1 << 31` - Reserved
	- Note: `ir[mask] & 0x07FF` *must* align with `vnode.mask & 0x07FF`.
- `ir[id]` - Internal node ID, used for simplifying update batching
- `ir[key]` - Element key
- `ir[parent]` - Closest element parent
- `ir[remove]` - `ref` removal hook

Notes:

- In the MVP, this can just normalize the vnodes into internal IR, replacing them as necessary. This is all just internal whatnot.

## Context

Context instance:

- `context._ir` - Direct reference to component vnode IR

Note: Contexts are mostly just simple dependency injection objects that let you redraw things.

## Operations

These operations are a little arcane, but that's because it involves quite a bit of bitwise inspection and comparison against the vnode and internal node masks. It's heavily annotated to help others understand what's actually going on here.

### Get patch strategy

- If `(vnode.mask & 0xFF) === 0`, skip.
	- If the incoming vnode is a `m(Retain)` vnode, skip.
- If `(ir[mask] & 0x07FF) !== (vnode.mask & 0x07FF)`, replace.
	- If the incoming vnode's tag type doesn't match the internal vnode's tag type, replace.
	- If the incoming vnode has a key and the internal vnode doesn't, replace.
	- If the internal vnode has a key and the incoming vnode doesn't, replace.
- If `(ir[mask] & 0xFA) === 8 && ir[tag] !== vnode.tag`, replace.
	- If the incoming vnode's component doesn't equal the internal vnode's component, replace.
	- If the incoming vnode's tag name doesn't equal the internal vnode's tag name, replace.
	- If the incoming vnode's portal doesn't equal the internal vnode's portal, replace.
- If `(ir[mask] & 1 << 10) !== 0 && ir[key] !== vnode.key`, replace.
	- If the vnodes have keys and the incoming vnode's key doesn't equal the internal vnode's key, replace.
- Else, patch.

## Why keep it JSON-compatible?

This is in large part due to disagreement with [React's decision to block it](https://overreacted.io/why-do-react-elements-have-typeof-property/) somewhat. They make security claims, but I'm not convinced they're serious in any remotely sane set-up:

- They note that it's *very* difficult to block arbitrary JavaScript in general and that their defense could still be penetrated in many circumstances.
- Some of the potential vulnerabilities they claim exist are almost certainly *not* exploitable in practice.
	- The section on "[...] if your server has a hole that lets the user store an arbitrary JSON object while the client code expects a string, [...]" is itself fairly niche, and even in this case, you almost always do further processing before rendering the value.
