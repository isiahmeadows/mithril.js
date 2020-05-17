[*Up*](./README.md)

# Internal Representation

The internal representation for the DOM renderer is going to be a little more complex, but for the sake of performance. It derives a lot of inspiration from [Dodrio](https://github.com/fitzgen/dodrio), which does *not* use the traditional tree representation, but instead uses two split bump allocation pools.

## Vnode tree

The vnode tree is tracked in an array. There are two separate "old" and "new" arrays, so it remains entirely immutable. The array contains a series of nodes representing everything, and they align one-to-one with [each of the various node types](../vnodes.md#low-level). For clarity, here's each of those node types, and for non-primitive ones, their type + the data they contain in their `vnode._` property:

- Hole: `null`, `undefined`, `true`, `false`
- Text: strings, numbers
- Fragment: arrays of vnode children
- Retain: `m.RETAIN`
    - Type: `0`
    - Data: none
- Element: `m("div", attrs, ...children)`
    - Type: `1`
    - Data: `[tag, attrs, ...children]`
- State: `m.state(body, ...children)`
    - Type: `2`
    - Data: `[body, ...children]`
- Link: `m.link(id, ...children)`
    - Type: `3`
    - Data: `[id, ...children]`
- Keyed: `m.keyed(coll, () => key, () => body)`
    - Type: `4`
    - Data: `[key, value, ...]` (flattened list of key/value pairs)
- Static hint: `m.create(StaticType, vnode)`
    - Type: `5`
    - Data: `vnode`
- Catch error in subtree: `m.catch(callback, ...children)`
    - Type: `6`
    - Data: `[callback, ...children]`
- Trust: `m.trust(string)`
    - Type: `7`
    - Data: `[Comp, ...children]`
- Component: `m(Comp, attrs, ...children)`
    - Type: `8`
    - Data: `[Comp, attrs, ...children]`
- Portal: `m(node, attrs, ...children)`
    - Type: `8`
    - Data: `[node, attrs, ...children]`

Their internal storage is considerably different, however. The internal representation uses constant-size blocks of the following structure, in the following order:

- Mask:
    - Type (bits 0-3)
    - Is removed flag (bit 4)
        - Vnodes that are currently being removed, but still need preserved as their removal is blocked, are tracked with this bit
    - Is static flag (bit 5)
        - This is applied to static vnodes and their descendants
    - Child count (bits 8-32)
- Value
- Node count
- Reference

For those with a child vnode count greater than 0, they are then followed by that many child vnodes.

As an implementation restriction, only the first 16777216 children are read from each vnode (and similarly, the first 16777216 keys in keyed vnodes), and the rest are flatly ignored.

> Note: these are intentionally structured such that it's extremely easy to generically process. Also, the type and node count are merged into a single number for memory reasons.
>
> Why 28 bits for the child count? It's highly unlikely anyone will ever need over 16 million immediate vnode children when rendering to the DOM directly unless they're doing something *very* wrong. On most devices, you'll crash the page first just due to the memory requirements - merely creating a text node via DOM APIs without adding it to anything results in 28 bytes allocated in Chrome, and a simple `_.range(0, 100).map(i => m("div.test", m("strong", "Test"), " ", i))` rendered manually to DOM racks up a whopping 14k bytes. Also, this is only for the DOM renderer, not necessarily others (who can choose to do things differently). For the first, 28 bytes \* 2^24 = 448MiB, and for the second, 14000 bytes \* 2^24 = 218.75GiB (yes, you read that correctly).

These comprise a flattened tree representation, enumerated in a depth-first preorder traversal. For state vnodes, outer children precede inner children.

There are two additional arrays so things like portals can still work reasonably efficiently:

- A resizable ready callback array cleared after every render, for `info.whenReady(callback)`.
- A root redraw queue, for `info.redraw` and friends so they don't need to wait an additional tick to operate. This is handled internally with a resizable circular buffer. This is also used with every recursive `render` call.

## Types

*TODO: ensure it's clear that empty fragments are converted to holes.*
*TODO: ensure it's clear that state vnodes contain the child vnode count + 1 children, with the last corresponding to their rendered output.*

There are 11 internal types, and these do *not* align one-to-one with received types - these are meant for fast internal processing. Here's the data for each internal type:

- Fragment:
    - Type: `0`
    - Child count: number of children
    - Value: `undefined`
    - Node count: number of encapsulated nodes
    - Reference: `undefined`

- Element:
    - Type: `1`
    - Child count: number of children + `1`
    - Value: tag name
    - Node count: `1`
    - Reference: element reference
    - First child: attributes instance (synthetic)

- State:
    - Type: `2`
    - Child count: `1`
    - Value: `undefined`
    - Node count: number of encapsulated nodes
    - Reference: component info object
    - First child: component instance (always non-synthetic)

- Link:
    - Type: `3`
    - Child count: number of children
    - Value: current identity
    - Node count: number of encapsulated nodes
    - Reference: `undefined`

- Keyed:
    - Type: `4`
    - Child count: number of children
    - Value: map of key -> index computed from the last set of keys
    - Node count: number of encapsulated nodes
    - Reference: `undefined`

- Static:
    - Type: `5`
    - Child count: `1`
    - Value: `undefined`
    - Node count: number of encapsulated nodes
    - Reference: `undefined`

- Catch:
    - Type: `6`
    - Child count: number of children
    - Value: catch callback
    - Node count: number of encapsulated nodes
    - Reference: `undefined`

- Trust:
    - Type: `7`
    - Child count: `0`
    - Value: text string
    - Node count: number of encapsulated nodes
    - Reference: `undefined`

- Component:
    - Type: `8`
    - Child count: number of children + `1`
    - Value: component reference
    - Node count: number of encapsulated nodes
    - Reference: component info object
    - First child: component instance (always non-synthetic)

- Text:
    - Type: `9`
    - Child count: `0`
    - Value: text string
    - Node count: `1`
    - Reference: text node

- Portal:
    - Type: `10`
    - Child count: `0`
    - Value: text string
    - Node count: `1`
    - Reference: text node

- Removed callback (synthetic):
    - Type: `11`
    - Child count: `0`
    - Value: callback reference
    - Node count: `0`
    - Reference: `undefined`

- Attributes (synthetic):
    - Type: `12`
    - Child count: `0`
    - Value: attributes or `undefined` if no attributes exist
    - Node count: `0`
    - Reference: `undefined`

The initial type/child count mask and value for internal nodes can be derived from vnodes using the following algorithm:

```js
const info = (mask, value) => ({mask, value})

function extractVnodeInfo(vnode) {
    if (vnode == null || typeof vnode === "boolean") {
        return [info(0 /* fragment */ | 0 << 8)]
    }

    if (typeof vnode !== "object") {
        return [info(9 /* text */ | 1 << 8, String(vnode))]
    }

    if (Array.isArray(vnode)) {
        return [info(0 /* fragment */ | vnode.length << 8)]
    }

    switch (vnode["%"]) {
    case 0:
        return null /* retain */

    case 1:
        return [
            info(1 /* element */ | vnode._.length << 8, vnode._[0]),
            info(12 /* attributes */ | 1 << 8, vnode._[0]),
        ]

    case 2:
        return [info(2 /* state */ | 1 << 8)]

    case 3:
        return [info(3 /* link */ | (vnode._.length - 1) << 8, vnode._[0])]

    case 4:
        return [info(4 /* keyed */ | vnode._.length << 7,
            new Map(Array.from({length: vnode._.length / 2}, (_, i) =>
                [vnode._[i * 2], i]
            ))
        )]

    case 5:
        return [info(5 /* static */ | 1 << 8)]

    case 6:
        return [info(6 /* catch */ | (vnode._.length - 1) << 8, vnode._[0])]

    case 7:
        return [info(7 /* trust */ | 0 << 8, vnode._)]

    case 8:
        return [info(8 /* component */ | vnode._.length << 8, vnode._[0])]

    default:
        throw new TypeError("Non-vnode objects are not children.")
    }
}
```
