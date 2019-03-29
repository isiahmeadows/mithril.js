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

Well, it comes to three things: memory usage, GC churn, and CPU performance. I'm not writing a simple theoretical toy, but a literal UI engine. I'm imagining it built closer to a game physics engine crossed with a VM, so it's near-zero overhead.

Note that everything beyond the hyperscript vnode structure detailed below is purely implementation detail and is *not* required for any MVP. (It might not even happen, and I'm not going to prototype the redesign's renderer using it - I'll wait until a later point in time to try it out.)

## Hyperscript vnode structure

The vnodes are initially just this when returned from views. `m` returns either a DOM vnode, component vnode, trusted vnode, fragment vnode, or keyed fragment vnode.

- Holes: `true`, `false`, `null`, and `undefined`
- Text: `"string"`, `0`, `1.2`, and similar
- Control: `(render, context) => done?`, `Cell.map(cell, func)`, and similar
- Fragment arrays: `[...]`
- Fragment vnodes: `{tag: "#fragment", attrs: {key?, ref?, children: [...]}}`
- Keyed fragment vnodes: `{tag: "#keyed", attrs: {key?, ref?, children: [...]}}`
- Trusted vnodes: `{tag: "#trust", attrs: {key?, children: ["value"]}}`
- DOM vnode: `{tag: "elem", attrs: {key?, ref?, children: [...], ...}}`
- Component vnode: `{tag: Component, attrs: {key?, ref?, children: [...], ...}}`

Notes:

- `m` just resolves the hyperscript selector into attributes.
- The attributes are *always* an object, even if it's empty.
- The children are *always* an array, even if it's empty.
- This is *not* normalized. It's just returned directly.

## Resolved vnode structure

The vnode children, including text strings, are resolved internally to this to allow engines to optimize for a single type map.

Total: 6 fields

- `vnode.mask` - Inline cache mask
	- `vnode.mask & 0x000F` - Type ID
	- `vnode.mask & 1 << 4` - Custom element (either autonomous or customized)
	- `vnode.mask & 1 << 7` - Has `key`
	- `vnode.mask & 1 << 8` - Has `ref`
	- Note: `id & 0x00FF` *must* align with `vnode.mask & 0x00FF`.
- `vnode.tag` - Tag/custom element name/component name/control body
- `vnode.is` - `is` name
- `vnode.attrs` - Resolved non-special attributes
- `vnode.children` - Children/text
- `vnode.key` - Resolved `attrs.key`
- `vnode.ref` - Resolved `attrs.ref`

Notes:

- An error is thrown if `vnode.attrs.children.length > 2 ** 16`
- Holes are represented by `null`s
- For DOM and component vnodes, attributes are retained with `is` (for customized built-in elements), `key`, `children`, and `ref` removed.
- For component vnodes, attributes are retained with only `key` removed. `children` is ignored.
- Fragments do *not* store their attributes - those are only used to read the `key` and `children`. Pass component instances around instead - even if they aren't used, they can still be useful for verifying types.
- This step is only incrementally performed. Children are lazily normalized.

This is *very* heavily optimized towards being monomorphic and strongly typed.

### Why not normalize it immediately?

Few reasons related to performance:

1. The return value is highly polymorphic anyways. Pretending it's monomorphic isn't going to change that.
2. Normalizing vnodes as you need them have the added benefit of leveraging the GC's nursery, which could potentially result in zero-cost object allocation. It gives you the benefits of monomorphic objects without the cost of allocating them, which in turn reduces the stress on the GC.
3. The performance cost of polymorphic and megamorphic types isn't in terms of the values themselves, but in all the implicit type checks. You're either taking the hit in one place or another, but you're taking the hit either way. (I've already dealt with how to reduce the impact of polymorphism in fast deep object matching.)

Also, not everyone has the same needs as the DOM renderer.

- The HTML renderer doesn't need to normalize its input at all. It just needs to take note of various types and dispatch accordingly, as it doesn't need to diff anything.
- A hypothetical native renderer would likely instead normalize it to a native struct containing most of these members. It would also want to normalize names to direct constructor/type IDs, and it'd likely *not* need `is`.

## Mithril DOM IR structure

TODO: update this

The IR vnodes are arranged as arrays to minimize memory and let them be quickly read without confusing the engine with polymorphic types. Specifically:

- No engine stores raw descriptors in arrays, and none of them store ICs for individual elements like they do for objects. It's always one of a few types, with both dense and holey variants:
	- Some provide an unspecialized "empty array" type that precedes a standard typed representation.
	- Integer arrays contain only 32-bit integer data
	- Double arrays contain only 64-bit float data
	- Object arrays contain only polymorphic references to values
- Each element is really tracked as an index into four separate global arrays:
	- `idata`: an array containing basic type info + children IDs.
	- `odata`: an array containing object type info, like tags, etc.
	- `ndata`: an array containing the raw DOM nodes.
	- `adata`: an array containing auxiliary, usually-missing data like `done` callbacks, `is` values, etc.
	- Global queues exist for each of these, used to add elements when there isn't room before or at the current read counter.

Using this method, I can avoid a lot of the memory cost, and iterating values becomes a lot faster because I have one memory load instead of 2 for each read.

Here's the general vnode structure, consisting of 5 integers + 5 polymorphic fields:

- `id` = The index used to read `idata`, carrying basic metadata on the type itself in an attempt to avoid the need to load data into memory for simple checks.
	- `id & 0x000F` = Type ID
	- `id & 1 << 4` = Custom element (either autonomous or customized)
	- `id & 1 << 7` = Has `key`
	- `id >>> 8` = The real index used
	- Note: all data stored here *must* remain the same across the entire lifetime of the vnode itself, so it can only really be used for diffing types.
	- Note: `id & 0x00FF` *must* align with `vnode.mask & 0x00FF`.
- `idata[(id >>> 8) * 4 + 0] = status` - Status mask
	- `mask & 1 << 0` = Has removal hook on self or descendant
		- This flag is reset on every element after checking, and is re-toggled if it still has one added
		- This flag is unset on parents with no subscribed children after checking
	- `mask & 1 << 1` = Has removal hook on self
	- `mask & 1 << 2` = Has meaningful DOM attributes
	- `mask >>> 8` = Closest element parent ID or `-1` if this is the root node.
- `idata[(id >>> 8) * 4 + 1] = state` - Memoized state index or `-1` if state doesn't need retained.
- `idata[(id >>> 8) * 4 + 2] = domStart` - DOM index start
- `idata[(id >>> 8) * 4 + 3] = domEnd` - DOM index end (as in, index after last)
- `odata[(id >>> 8) * 4 + 0] = tag` - Element tag
- `odata[(id >>> 8) * 4 + 1] = key` - Element key
	- Note: if `mask & 1 << 0`, this is always set to `undefined`.
- `odata[id * 4 + 2] = children` - Children IDs with holes represented by `-1`s or `undefined` for text nodes and raw nodes
- `odata[id * 4 + 3] = typeData` - Type-dependent data, `undefined` unless otherwise specified

Each node is referred to by an ID pointer.

- All IR nodes are indexed per-root in order of appearance, and their indices are updated on each render.
- This is used together with `parentId` checking to avoid attempting to schedule a redraw whenever one is already scheduled for that segment.
- After updating a segment, all subsequent children are updated.

Here are the types:

- Hole:
	- Type ID: `id === 0`
	- This does *not* have any corresponding data in `idata`, `odata`, `ndata`, or `adata`, so the index field is ignored.
	- Conveniently, this means holes can be created as just `id === 0`.

- Control:
	- Type ID: `(mask & 0x000F) === 0x1`
	- `tag` = Control body
	- `state` = `done` callback
	- `typeData` = Control context
	- Note: `domStart` and `domEnd` are inferred from children.
	- Assert: `Array.isArray(children)`
	- Assert: `state === -1`

- Text:
	- Type ID: `(mask & 0x000F) === 0x2`
	- `typeData` = String contents
	- Assert: `domStart === domEnd - 1`
	- Assert: `tag === undefined`
	- Assert: `children === undefined`
	- Assert: `state === -1`

- HTML:
	- Type ID: `(mask & 0x000F) === 0x3`
	- `tag` = String contents
	- Assert: `children === undefined`
	- Assert: `typeData === undefined`
	- Assert: `attrs === -1`

- Keyed:
	- Type ID: `(mask & 0x000F) === 0x4`
	- `children` = Fragment children
	- Note: `domStart` and `domEnd` are inferred from children.
	- Assert: `tag === undefined`
	- Assert: `Array.isArray(children)`
	- Assert: `typeData === undefined`
	- Assert: `attrs === -1`

- Fragment:
	- Type ID: `(mask & 0x000F) === 0x5`
	- `children` = Fragment children
	- Note: `domStart` and `domEnd` are inferred from children.
	- Assert: `tag === undefined`
	- Assert: `Array.isArray(children)`
	- Assert: `typeData === undefined`
	- Assert: `attrs === -1`

- Component:
	- Type ID: `(mask & 0x000F) === 0x6`
	- `tag` = Component reference
	- `children` = Component instance
	- `state` = Component attributes if any are cells, `-1` if all are constant.
	- `typeData` = Component attribute subscriptions
	- Note: `domStart` and `domEnd` are inferred from children.
	- Assert: `Array.isArray(children)`

- DOM:
	- Type ID: `(mask & 0x000F) === 0x7`
	- `tag` = Tag name
	- `children` = Element children
	- `state` = `is` name
	- `typeData` = DOM event handler
	- `typeData.attrs` = Element attributes
	- `typeData.id` = Type ID back pointer
	- Assert: `domStart === domEnd - 1`
	- Assert: `Array.isArray(children)`
	- Assert: `typeData` is `undefined` when the element has no attributes other than `key` or `ref`.
	- Assert: `state !== -1` when the element has no attributes other than `key` or `ref`

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

### Normalize

Vnodes upon receipt are normalized to a structure that somewhat mirrors the IR. This resolves meaningless discrepancies between vnode types and is sufficient for various checks. Note that because this object doesn't get persisted at all, it's almost certainly going to stay in the GC nursery (and thus be collected at potentially zero cost).

```js
var hasOwn = Object.prototype.hasOwnProperty
var empty = []

function create(mask, tag, is, attrs, children, key, ref) {
	return {mask, tag, is, attrs, children, key, ref}
}

function createSimpleObject(mask, tag, attrs, children) {
	var key = attrs.key; if (key != null) mask |= 1 << 7
	var ref = attrs.ref; if (ref != null) mask |= 1 << 8
	return create(mask, tag, undefined, undefined, children, key, ref)
}

function omit(object, regexp) {
	var result = {}
	for (var name in object) {
		if (hasOwn.call(object, name) && !regexp.test(object)) {
			result[name] = object[name]
		}
	}
	return result
}

function normalizeDOM(tag, attrs, children) {
	var mask = 0x7 | (tag.indexOf("-") !== -1) << 4
	var is = attrs.is, key = attrs.key, ref = attrs.ref
	var set = (is != null) << 4 | (key != null) << 7 | (ref != null) << 8

	if (children.length === 0 && set === 0) {
		return create(mask, tag, undefined, attrs, empty, undefined, undefined)
	}

	return create(
		mask | set,
		tag, is, omit(attrs, /^(children|is|key|ref)$/),
		children, key, ref
	)
}

function normalize(vnode) {
	if (vnode == null || typeof vnode === "boolean") return undefined
	if (typeof vnode === "object") {
		if (Array.isArray(vnode)) {
			if (vnode.length === 0) return undefined
			return create(0x5, void 0, void 0, void 0, vnode, void 0, void 0)
		}

		var tag = vnode.tag
		var attrs = vnode.attrs

		if (attrs == null) {
			// HTML, Keyed, Fragment
			if (tag != null) {
				if (tag === "#html" || tag === "#keyed" || tag === "fragment") {
					return undefined
				}
				if (typeof tag === "string") {
					// Rough apprximate sanity check to capture only valid
					// DOM tag names, including custom element names. The
					// HTML spec requires all elements, including custom
					// elements, to start with an ASCII alpha character.
					if (!/^[a-z][^.:#\s]+$/i.test(tag)) {
						throw new TypeError("Objects must be valid vnodes!")
					}
					return create(
						0x7 | (tag.indexOf("-") !== -1) << 4,
						tag, undefined, undefined, empty, undefined, undefined
					)
				}
				if (typeof tag === "function") {
					return create(
						0x6, tag, undefined, undefined,
						undefined, undefined, undefined
					)
				}
			}
			throw new TypeError("Objects must be valid vnodes!")
		} else {
			if (tag == null) {
				throw new TypeError("Objects must be valid vnodes!")
			}
			if (typeof tag === "string") {
				var children = attrs.children
				if (children == null) children = empty
				switch (tag) {
					// HTML
					case "#html":
						tag = children.join("")
						if (tag.length === 0) return undefined
						return createSimpleObject(0x3, tag, attrs, undefined)

					// Keyed, Fragment
					case "#keyed":
					case "#fragment":
						if (children.length === 0) return undefined
						return createSimpleObject(
							// 6 = "#keyed".length
							tag.length === 6 ? 0x4 : 0x5,
							undefined, attrs, children
						)

					default:
						// Rough apprximate sanity check to capture only valid
						// DOM tag names, including custom element names. The
						// HTML spec requires all elements, including custom
						// elements, to start with an ASCII alpha character.
						if (!/^[a-z][^.:#\s]+$/i.test(tag)) {
							throw new TypeError("Objects must be valid vnodes!")
						}
						return normalizeDOM(tag, attrs, children)
				}
			} else if (typeof tag === "function") {
				var mask = 0x6
				var key = attrs.key
				if (key != null) {
					mask |= 1 << 7
					attrs = omit(attrs, /^key$/)
				}
				return create(
					0x86, tag, undefined, attrs,
					undefined, undefined, key
				)
			} else {
				throw new TypeError("Objects must be valid vnodes!")
			}
		}
	} else if (typeof vnode === "function") {
		return create(
			0x1, vnode, undefined, undefined,
			undefined, undefined, undefined
		)
	} else {
		vnode = String(vnode)
		if (vnode === "") return undefined
		return create(
			0x2, undefined, vnode, undefined,
			undefined, undefined, undefined
		)
	}
}
```

### Check if a subtree should be patched or replaced

Rules:

1. If the internal vnode is a hole and the received vnode is a hole, patch.
2. If the internal vnode is a hole and the received vnode is not a hole, replace.
3. If the internal vnode is not a hole and the received vnode is a hole, replace.
4. If the internal vnode is of a different type than the received vnode, replace.
5. If the internal vnode's tag is different than the received vnode's tag, replace.
6. If the internal vnode has a key and the received vnode doesn't, replace.
7. If the internal vnode doesn't have a key and the received vnode does, replace.
8. If the internal vnode's key is different than the received vnode's key, replace.
9. If the internal vnode's `is` value is different than the received vnode's `is` value, replace.
10. Otherwise, patch.

```js
function shouldReplace(id, vnode) {
	// Steps 1-3
	if (vnode == null) return id === 0
	// Steps 4, 6, and 7
	if ((vnode.mask ^ id) & 0xFF) return true
	const index = (id >>> 8) << 4
	// Step 5
	if (vnode.tag !== odata[index]) return true
	// Step 8
	if (vnode.key !== odata[index + 1]) return true
	// Step 9
	if ((id & 0xF) !== 0x7) return false
	return vnode.is !== (
		idata[index + 1] < 0 ? undefined : adata[idata[index + 1]]
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
