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

### Why this complicated mess?

Well, it comes to three things: memory usage, GC churn, and CPU performance. I'm not writing a simple theoretical toy, but a literal UI engine. It's built closer to a game physics engine crossed with a VM, so it's near-zero overhead.

## Hyperscript vnode structure

The vnodes are arranged as objects to allow engines to optimize for a single type map.

Total: 6 fields

- `vnode.mask` - Inline cache mask
	- `vnode.mask & 0x00FF` - Type ID
	- `vnode.mask & 1 << 8` - Custom element (either autonomous or customized)
	- `vnode.mask & 1 << 9` - Is void, special, or known empty
	- `vnode.mask & 1 << 10` - Has `key`
	- `vnode.mask & 1 << 11` - Has `ref`
	- `vnode.mask & 1 << 12` - Is known single
- `vnode.tag` - Tag/custom element name/component name/control body
- `vnode.attrs` - Resolved non-special attributes
- `vnode.children` - Children/child nodes
- `vnode.key` - Resolved `attrs.key`
- `vnode.ref` - Resolved `attrs.ref`

Notes:

- An error is thrown if `vnode.attrs.children.length > 2 ** 16`
- Holes are represented by `null`s
- For DOM and component vnodes, attributes are serialized to a flattened array of `key`/`value` pairs with `is` (for known DOM vnodes only), `key`, `children`, and `ref` removed.
- Fragments do *not* store their attributes - those are only used to read the `key` and `children`. Pass component instances around instead - even if they aren't used, they can still be useful for verifying types.
- This resolves the polymorphic `children`, `key`, and `ref` accesses immediately.
- For customized builtins, `vnode.tag` is set to `vnode.attrs.is`. This is the only case where a vnode property is set to an attribute.
- A `Mithril.create(mask, tag, attrs, children, key, ref)` exists to create this structure, but `m` is preferred when `tag` is dynamic.
- For empty arrays, always return `null`/`undefined` for their attributes and children

This is *very* heavily optimized towards being monomorphic and strongly typed.

## Mithril DOM IR structure

TODO: update this

The IR vnodes are arranged as arrays to minimize memory and let them be quickly read without confusing the engine with polymorphic types. Specifically:

- Chrome and Firefox both pre-allocate room in arrays for 8 entries immediately (I've verified this), and I suspect Edge and Safari are likely similar.
- Each element is really tracked as three separate objects within global arrays:
	- `idata`: an array containing basic type info + children IDs.
	- `odata`: an array containing object type info, like tags, attrs, etc.
	- `ndata`: an array containing the raw DOM nodes
	- Global queues exist for each of these, used to add elements when there isn't room before or at the current read counter.
- Keys are resolved to integers using a global object instance, for simplicity and to fit better with the highly numeric nature of this.

Here's the general vnode structure, consisting of 4 integers + 4 polymorphic fields:

- `idata[(id << 2) + 0] = mask` - Inline cache mask
	- `mask & 0x00FF` = Type ID
	- `mask & 1 << 8` = Custom element (either autonomous or customized)
	- `mask & 1 << 9` = Is void, special, or known empty
	- `mask & 1 << 10` = Has `key`
	- `mask & 1 << 12` = Has removal hook on self or descendant
	    - This flag is reset on every element after checking, and is re-toggled if it still has one added
		- This flag is unset on parents with no subscribed children after checking
	- `mask & 1 << 13` = Has removal hook on self
	- Note: `mask & 0x07FF` *must* align with `vnode.mask & 0x07FF`.
- `idata[(id << 2) + 1] = parentId` - Closest element parent ID or `-1` if this is the root node.
- `idata[(id << 2) + 2] = domStart` - DOM index start
- `idata[(id << 2) + 3] = domEnd` - DOM index end (as in, index after last)
- `odata[(id << 2) + 0] = tag` - Element tag
- `odata[(id << 2) + 1] = key` - Element key
	- Note: if `mask & 1 << 12`, this is always set to `undefined`.
- `odata[(id << 2) + 2] = children` - Children IDs with holes represented by `-1`s or `undefined` for text nodes and raw nodes
- `odata[(id << 2) + 3] = typeData` - Type-dependent data, `undefined` unless otherwise specified

Each node is referred to by an ID pointer.

- All IR nodes are indexed per-root in order of appearance, and their indices are updated on each render.
- This is used together with `parentId` checking to avoid attempting to schedule a redraw whenever one is already scheduled for that segment.
- After updating a segment, all subsequent children are updated.

Here are the types:

- Text:
	- `typeData` = String contents
	- Assert: `domStart === domEnd - 1`
	- Assert: `tag === undefined`
	- Assert: `children === undefined`

- Trust:
	- `tag` = String contents
	- Assert: `children === undefined`
	- Assert: `typeData === undefined`

- Keyed:
	- `typeData` = Fragment key/index map
	- Note: `domStart` and `domEnd` are inferred from children.
	- Assert: `tag === undefined`
	- Assert: `Array.isArray(children)`

- Fragment:
	- Note: `domStart` and `domEnd` are inferred from children.
	- Assert: `tag === undefined`
	- Assert: `Array.isArray(children)`
	- Assert: `typeData === undefined`

- DOM:
	- `tag` = Mask-dependent:
		- `(mask & 0x00FF) === 9`: Custom element tag name
		- `(mask & 1 << 8) !== 0`: Custom element `is` name
		- Otherwise: `undefined`
	- `typeData.attrs` = DOM attributes
	- `typeData.events` = DOM event map
	- Assert: `domStart === domEnd - 1`
	- Assert: `Array.isArray(children)`

- Component:
	- `tag` = Component reference
	- `typeData.attrs` = Component attributes if any are cells, `undefined` if all are constant.
	- `typeData.subs` = Component attribute subscriptions
	- Note: `domStart` and `domEnd` are inferred from children.
	- Assert: `Array.isArray(children)`

- Control:
	- `tag` = Control body
	- `typeData.context` = Control context
	- `typeData.done` = `done` callback
	- Note: `domStart` and `domEnd` are inferred from children.
	- Assert: `Array.isArray(children)`

Notes:

- In the MVP, this can just normalize the vnodes into internal IR, replacing them as necessary. This is all just internal whatnot.
- This is *highly* specific to Mithril's core renderer. Other renderers may choose to implement their IR differently, and in some cases (like native renderers), they likely have different data structures.

## Context

Context instance:

- `context._ir` - Vnode IR index, or `-1` if unmounted
	- This sentinel exists mainly for sanity checks to avoid certain issues.

Note: Contexts are mostly just simple dependency injection objects that let you redraw things.

## Operations

These operations are a little arcane, but that's because it involves quite a bit of bitwise inspection and comparison against the vnode and internal node masks. It's heavily annotated to help others understand what's actually going on here.

### Check if vnode should be replaced or patch

Rules:

1. If the incoming vnode's type doesn't match the internal vnode's type, replace.
2. If the incoming vnode's tag doesn't match the internal vnode's tag, replace.
3. If the incoming vnode has a key and the internal vnode doesn't, replace.
4. If the internal vnode has a key and the incoming vnode doesn't, replace.
5. If the incoming vnode's key doesn't match the internal vnode's key, replace.
6. Else, patch.

```js
function shouldReplace(id, vnode) {
	return (
		// Steps 1, 3, and 4
		((idata[id << 2] ^ vnode.mask) & 0x07FF) !== 0 ||
		// Step 2
		odata[id << 2] !== vnode.tag ||
		// Step 6
		odata[(id << 2) + 1] !== vnode.key
	)
}
```

### Skip subtree

This searches for the next walkable subtree's IR ID and returns it, or `-1` if this is the last node. It works by checking the next sibling of the current child and if that fails, recursing to the parent.

```js
// Returns the new index. Takes a fair bit of pointer chasing here.
function skipSubtree(id) {
	while (id >= 0) {
		const parent = idata[(id << 2) + 1]
		const children = odata[(parent << 2) + 2]
		const index = children.indexOf(id) + 1

		if (index !== children.length) return children[index]
		id = parent
	}
	return id
}
```

Note that this doesn't itself account for updating iteration offsets.

## Why keep vnodes JSON-compatible?

This is in large part due to disagreement with [React's decision to block it](https://overreacted.io/why-do-react-elements-have-typeof-property/) somewhat. They make security claims, but I'm not convinced they're serious in any remotely sane set-up:

- They note that it's *very* difficult to block arbitrary JavaScript in general and that their defense could still be penetrated in many circumstances.
- Some of the potential vulnerabilities they claim exist are almost certainly *not* exploitable in practice.
	- The section on "[...] if your server has a hole that lets the user store an arbitrary JSON object while the client code expects a string, [...]" is itself fairly niche, and even in this case, you almost always do further processing before rendering the value.
	- It notes pretty clearly it *doesn't* protect against things like `href: "javascript:doSomethingReallyEvil()"` or spreading untrusted attributes.
	- Most of the hypotheticals are just about things frameworks already address, like unescaped strings and the like.
- The obvious case of an object without a `.mask` is already rejected for reasons other than this, but it'd also catch 99% of the issues that'd really occur in practice, including some I've encountered personally.
