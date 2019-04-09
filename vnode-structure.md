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

Well, it comes to three things: memory usage, GC churn, and CPU performance. I'm not writing a simple theoretical toy, but a literal UI engine. I'm imagining it built closer to a game physics engine crossed with a VM, so it's leveraging CPU pipelines and caches where possible.

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
- Catch vnodes: `{tag: "#catch", attrs: {key?, onerror, children: [...]}}`
- DOM vnode: `{tag: "elem", attrs: {key?, ref?, children: [...], ...}}`
- Component vnode: `{tag: Component, attrs: {key?, ref?, children: [...], ...}}`

Notes:

- `m` just resolves the hyperscript selector into attributes.
- The attributes are *always* an object, even if it's empty.
- The children are *always* an array, even if it's empty.
- This is *not* normalized. It's just returned directly.

## Resolved vnode structure

The vnode children, including text strings, are resolved internally to this to allow engines to optimize for a single type map.

Total: 8 fields

- `vnode.mask` - Inline cache mask
	- `vnode.mask & 0x000F` - Type ID
	- `vnode.mask & 1 << 4` - Custom element (either autonomous or customized)
	- `vnode.mask & 1 << 5` - Has `key`
	- `vnode.mask & 1 << 8` - Has `ref`
	- Note: `id & 0x00FF` *must* align with `vnode.mask & 0x00FF`.
- `vnode.tagID` - Resolved ID for tag/`is` name/custom element name/component name/control body
- `vnode.tagName` - Raw tag/custom element name/component name/control body
- `vnode.isName` - `is` name
- `vnode.attrs` - Resolved non-special attributes, `oncatch` for catch vnodes
- `vnode.children` - Children/text
- `vnode.keyID` - Resolved ID for `attrs.key`
- `vnode.ref` - Resolved `attrs.ref` for non-component object vnodes

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
	- `cdata`: an array containing the children IDs, with `0` representing holes.
	- Global queues exist for each of these, used to add elements when there isn't room before or at the current read counter.
	- A global `idMap` exists to map strings, functions, and keys to numeric indices for compressed storage. These are tracked and collected via simple reference counts. (Raw HTML contents are also stored in this map.) A free list is retained to avoid increasing the ID count without bound.

Using this method, I can avoid a lot of the memory cost, and iterating values becomes a lot faster because I have one memory load instead of 2 for each read.

Here's the general vnode structure, consisting of 8 integers + some associated data elsewhere:

- `id` = The index used to read `idata`, carrying basic metadata on the type itself in an attempt to avoid the need to load data into memory for simple checks.
	- `id & 0x000F` = Type ID
	- `id & 1 << 4` = Custom element (either autonomous or customized)
	- `id & 1 << 5` = Has `key`
	- `id >>> 8` = The real index used
	- Note: all data stored here *must* remain the same across the entire lifetime of the vnode itself, so it can only really be used for diffing types.
	- Note: `id & 0x00FF` *must* align with `vnode.mask & 0x00FF`.
- `idata[(id >>> 8) * 8 + 0] = tag` - Element tag ID, ignored for most control vnodes
- `idata[(id >>> 8) * 8 + 1] = parent` - Closest element parent ID or `-1` if this is the root node.
- `idata[(id >>> 8) * 8 + 2] = key` - Element key ID
- `idata[(id >>> 8) * 8 + 3] = typeData` - Type-dependent data index, ignored if none exist
	- Note that not all types use the same number of slots (most use 0 or 1, but DOM elements use 2), so you can't assume that `typeData + 1` represents the next element's index. You need to use the next ID and go through that indirection to get the its type-dependent data index. Note that all types use a static number of fields relative to that type, so it's still quickly calculable.
- `idata[(id >>> 8) * 8 + 4] = domStart` - DOM index start
- `idata[(id >>> 8) * 8 + 5] = domEnd` - DOM index end (as in, index after last)
- `idata[(id >>> 8) * 8 + 6] = childrenStart` - Children ID start, ignored for text nodes and trusted nodes
- `idata[(id >>> 8) * 8 + 7] = childrenLength` - Children length, ignored for text nodes and trusted nodes

Each node is referred to by an ID pointer.

- All IR nodes are indexed per-root in order of appearance, and their indices are updated on each render.
- This is used together with `parentId` checking to avoid attempting to schedule a redraw whenever one is already scheduled for that segment.
- After updating a segment, all subsequent children are updated.
- When scheduling renders, they're re-ordered in terms of earliest subtree first, to reduce memory movement.
- Ignored indices are basically uninitialized garbage. They can sometimes be modified just to avoid branching in loops, but they're otherwise just ignored and generally aren't even set when initializing.

Here are the types:

- Hole:
	- Type ID: `id === 0`
	- This does *not* have any corresponding data in `idata`, `odata`, `ndata`, or `cdata`, so the index field is ignored.
	- Conveniently, this means holes can be created as just `id === 0`.

- Control:
	- Type ID: `(mask & 0x000F) === 0x1`
	- `tag` = Resolved ID for control factory
	- `odata[typeData + 0]` = `done` callback
	- Note: `domStart` and `domEnd` are inferred from children.
	- Assert: `key === 0`.
	- Assert: `childrenLength === 0` before first render, `childrenLength === 1` after first render.

- Text:
	- Type ID: `(mask & 0x000F) === 0x2`
	- `odata[typeData + 0]` = String contents
	- Assert: `key === 0`.
	- Assert: `domStart === domEnd - 1`

- HTML:
	- Type ID: `(mask & 0x000F) === 0x3`
	- `tag` = Resolved ID for string contents

- Keyed:
	- Type ID: `(mask & 0x000F) === 0x4`
	- `childrenStart` + `childrenLength` = Fragment children
	- Note: `domStart` and `domEnd` are inferred from children.

- Fragment:
	- Type ID: `(mask & 0x000F) === 0x5`
	- `childrenStart` + `childrenLength` = Fragment children
	- Note: `domStart` and `domEnd` are inferred from children.

- Component:
	- Type ID: `(mask & 0x000F) === 0x6`
	- `tag` = Resolved ID for component reference
	- `childrenStart` + `childrenLength` = Fragment children
	- Note: `domStart` and `domEnd` are inferred from children.
	- Assert: `childrenLength === 1`.`

- DOM:
	- Type ID: `(mask & 0x000F) === 0x7`
	- `tag` = Resolved ID for tag name/`is` name
	- `childrenStart` + `childrenLength` = Element children
	- `odata[typeData + 0]` = Element attributes
	- `odata[typeData + 1]` = DOM event handler
	- `odata[typeData + 1].id` = Back pointer to this type ID
	- `odata[typeData + 1]["on" + event]` = Event handler
	- Assert: `domStart === domEnd - 1`
	- Assert: `odata[typeData + 0]` is initialized to `undefined` prior to any event handlers existing.

- Catch:
	- Type ID: `(mask & 0x000F) === 0x8`
	- `odata[typeData + 0]` = `onerror` callback
	- `childrenStart` + `childrenLength` = Fragment children
	- Note: `domStart` and `domEnd` are inferred from children.

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
var empty = []

function create(mask, tagID, tagName, isName, attrs, children, keyID, ref) {
	return {mask, tagID, tagName, isName, attrs, children, keyID, ref}
}

function createSimpleObject(mask, tag, attrs, children) {
	var key = attrs.key, ref = attrs.ref
	return create(
		mask | (key != null) << 5 | (ref != null) << 8,
		tag, 0, undefined, undefined, undefined, children,
		key != null ? getKeyID(key) : 0, ref,
	)
}

var componentFilter = /^(children|is|key|ref)$/
var domFilter = /^key$/

function omit(object, regexp) {
	var result = Object.create(null)
	for (var name in object) {
		if (
			Object.prototype.hasOwnProperty.call(object, name) &&
			!regexp.test(name)
		) {
			result[name] = object[name]
		}
	}
	return result
}

function normalizeDOM(tag, attrs) {
	var is = attrs.is, key = attrs.key, ref = attrs.ref
	return create(
		0x7 | (tag.indexOf("-") !== -1) << 4 |
		(is != null) << 4 | (key != null) << 5 | (ref != null) << 8,
		getKeyID(is != null ? is : tag),
		tag, is, omit(attrs, domFilter),
		children == null || children.length === 0 ? empty : children,
		key != null ? getKeyID(key) : 0, ref,
	)
}

function normalize(vnode) {
	if (vnode == null || typeof vnode === "boolean") return undefined
	if (typeof vnode === "object") {
		if (Array.isArray(vnode)) {
			if (vnode.length === 0) return undefined
			return create(
				0x5, 0, undefined, undefined,
				undefined, vnode, 0, undefined
			)
		}

		var tag = vnode.tag
		var attrs = vnode.attrs

		if (attrs == null) {
			// HTML, Keyed, Fragment
			if (tag != null) {
				if (
					tag === "#catch" ||
					tag === "#html" ||
					tag === "#keyed" ||
					tag === "fragment"
				) {
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
						getKeyID(tag), tag, undefined,
						undefined, empty, 0, undefined,
					)
				}
				if (typeof tag === "function") {
					return create(
						0x6, getKeyID(tag), tag, undefined,
						undefined, undefined, 0, undefined
					)
				}
			}
			throw new TypeError("Objects must be valid vnodes!")
		} else {
			if (tag == null) {
				throw new TypeError("Objects must be valid vnodes!")
			}
			if (typeof tag === "string") {
				switch (tag) {
					// HTML
					case "#html":
						var children = attrs.children
						tag = children != null ? children.join("") : ""
						if (tag.length === 0) return undefined
						return createSimpleObject(0x3, tag, attrs, undefined)

					// Keyed, Fragment
					case "#keyed":
					case "#fragment":
						var children = attrs.children
						if (children == null || children.length === 0) {
							return undefined
						}
						return createSimpleObject(
							// 6 = "#keyed".length
							tag.length === 6 ? 0x4 : 0x5,
							undefined, attrs, children
						)

					case "#catch":
						var children = attrs.children
						if (children == null || children.length === 0) {
							return undefined
						}
						var key = attrs.key, ref = attrs.ref
						var oncatch = attrs.oncatch
						return create(
							0x8 | (key != null) << 5 | (ref != null) << 8,
							tag, 0, undefined, undefined, oncatch, children,
							key != null ? getKeyID(key) : 0, ref,
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
				return create(
					0x6 | (key != null) << 5, getFunctionID(tag), tag, undefined,
					omit(attrs, componentFilter), undefined,
					getKeyID(key), undefined
				)
			} else {
				throw new TypeError("Objects must be valid vnodes!")
			}
		}
	} else if (typeof vnode === "function") {
		return create(
			0x1, getFunctionID(vnode), vnode, undefined,
			undefined, undefined, 0, undefined,
		)
	} else {
		vnode = String(vnode)
		if (vnode === "") return undefined
		return create(
			0x2, 0, undefined, undefined,
			undefined, vnode, 0, undefined
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
5. If the internal vnode's tag/`is` value is different than the received vnode's tag/`is` value, replace.
6. If the internal vnode has a key and the received vnode doesn't, replace.
7. If the internal vnode doesn't have a key and the received vnode does, replace.
8. If the internal vnode's key is different than the received vnode's key, replace.
9. If the internal vnode is not a custom element and the received vnode is, replace.
9. If the internal vnode is a custom element and the received vnode is not, replace.
10. Otherwise, patch.

```js
// This is purely integral and results in literally zero type checks.
function shouldReplace(id, vnode) {
	// Steps 1-3
	if (vnode == null) return id === 0
	// Steps 4, 6, and 7
	if ((vnode.mask ^ id) & 0xFF) return true
	// Step 5
	if (vnode.tagID !== idata[(id >>> 8) << 2]) return true
	// Step 8
	if (vnode.keyID !== idata[(id >>> 8) << 2 | 2]) return true
	// Step 9 and 10
	return (id & 0x8F) === 0x87
}
```

### Skip subtree

This searches for the next walkable subtree's IR ID and returns it, or `-1` if this is the last node. It works by checking the next sibling of the current child and if that fails, recursing to the parent.

```js
// Returns the new index. Takes a fair bit of pointer chasing here.
function skipSubtree(id) {
	const current = (id >>> 8) << 2
	while (id >= 0) {
		const nextId = idata[current + 1]
		const parent = (nextId >>> 8) << 2
		let i = idata[parent + 6]
		for (const end = i - 1 + idata[parent + 7]; i < end; i++) {
			if (cdata[i] === id) return cdata[i + 1]
		}
		id = nextId
		current = parent
	}
	return id
}
```

Note that this doesn't itself account for updating iteration offsets. It just finds the next offset to move to.

## General algorithm

The algorithm would be in-place, incremental, and procedural. It would use buffers to hold what can't go immediately into the arrays, so they can be eventually flushed.

TODO: elaborate on this section further
