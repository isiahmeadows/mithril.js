[*Up*](./README.md)

# Internal Representation

The internal representation for the DOM renderer is going to be a little more complex, but for the sake of performance. It derives a lot of inspiration from [Dodrio](https://github.com/fitzgen/dodrio), which does *not* use the traditional tree representation, but instead uses two split bump allocation pools.

## Vnode tree

The vnode tree is tracked in an array. There are two separate "old" and "new" arrays, so it remains entirely immutable. The array contains a series of nodes representing everything, and they align one-to-one with [each of the various node types](../vnodes.md#low-level). For clarity, here's each of those node types, and for non-primitive ones, their type + the data they contain in their `vnode._` property:

- Hole: `null`, `undefined`, `true`, `false`
- Text: strings, numbers
- Fragment: arrays of vnode children
- Retain: `m.RETAIN`
    - Data: none
- Element: `m("div", attrs, ...children)`
    - Data: `[tag, attrs, ...children]`
- State: `m.state(body, ...children)`
    - Data: `[void 0, body, ...children]`
- Link: `m.link(id, ...children)`
    - Data: `[id, void 0, ...children]`
- Keyed: `m.keyed(coll, () => key, () => body)`
    - Data: `[key, value, ...]` (flattened list of key/value pairs)
- Trust: `m.trust(text)`
    - Data: `text`
- Component: `m(Comp, attrs, ...children)`
    - Data: `[Comp, attrs, ...children]`
- Portal: `m(node, attrs, ...children)`
    - Data: `[node, attrs, ...children]`
- Transition: `m.transition(classPrefixOrOptions, child)`
    - Data: `[void 0, classPrefixOrOptions, child]`

Their internal storage is considerably different, however. The internal representation uses the following structure, consisting of 8 fields:

- Mask:
    - Type (bits 0-5)
    - Is static flag (bit 6)
        - This is applied to static vnodes and their descendants
        - This is the same bit position as in the vnodes.
    - Is removed flag (bit 7)
        - Vnodes that are currently being removed, but still need preserved as their removal is blocked, are tracked with this bit.
        - Vnodes that have already been removed, but need retained for internal bookkeeping (like for catch callbacks invoked on `whenRemoved`), are tracked with this bit as well.
    - Represented DOM node count (bit 8-31)
        - This for many types is non-zero to start.
        - For elements, this refers only to the element itself, not its children.
- Identity
- Removal callback start
- Removal callback end
- Parent catch IR node
    - This is always present, as errors could occur from component views, elements (if it throws an exception for some reason), state node views, or even text nodes (if provided a symbol). It also offers the ability to recover from a whole class of internal Mithril errors, in the rare event that occurs. Basically, byzantine fault tolerance.
- Children
    - This is `undefined` if the component has no children.
    - This is a map for keyed fragments, as their children is managed specially.
    - This is a single child for state and component vnodes, as their children are managed specially.
- Reference
- Value

> Note: these are intentionally structured such that it's extremely easy to generically process. Also, the type and node count are merged into a single number for memory reasons.
>
> Why 24 bits for the child node count? It's highly unlikely anyone will ever need over 16 million raw DOM nodes when rendering to the DOM directly unless they're doing something *very* wrong. On most devices, you'll crash the page first just due to the memory requirements - merely creating a text node via DOM APIs without adding it to anything results in 28 bytes allocated in Chrome, and a simple `_.range(0, 100).map(i => m("div.test", m("strong", "Test"), " ", i))` rendered manually to DOM racks up a whopping 14k bytes. Also, this is only for the DOM renderer, not necessarily others (who can choose to do things differently). For the first, 28 bytes \* 2^24 = 448MiB, and for the second, 14000 bytes \* 2^24 = 218.75GiB (yes, you read that correctly).
>
> Why are removal callback offsets stored? When removing a node, it's possible to just push these offset pairs into a list and then iterate through them, calling them and awaiting them all in parallel. (Way less work.) It's also possible to go through all of these and sum them up initially, to get a static "open" count, making it much faster to route errors.

These comprise a flattened tree representation, enumerated in a depth-first preorder traversal. For state vnodes, outer children precede inner children.

There are a few additional arrays so things like portals can still work reasonably efficiently:

- A resizable write callback queue cleared after every render, for `info.whenLayout(callback)` and `info.whenRemoved(callback)`.
- A resizable ready callback queue cleared after every render, for `info.whenReady(callback)` and `info.whenRemoved(callback)`.
- A resizable callback stack used to buffer write and removal callbacks as necessary, to align them in a postorder traversal order without nearly the bookkeeping.
- A root redraw queue, for `info.redraw` and friends so they don't need to wait an additional tick to operate. This is handled internally with a resizable circular buffer to simplify execution. This is also used with every recursive `render` call as well as with errors (as part of removing a given subtree).

## Write, ready, and removal callback lists

The ready callback list is an array of flattened struct of just two fields, to save memory during processing as it's a pretty common case:

- The callback's originating IR node
- The callback in question

> Non-layout removal callbacks are also scheduled into this queue.

The write callback list is an arrays of flattened structs, where each struct has three fields:

- The parent ref's IR node
- The parent catch callback's IR node
- The callback in question

Each of these two are paired with bit vectors to denote whether each corresponding callback is a remove callback or not.

Errors in write and ready callbacks propagate to the parent catch callback as fatal errors, and errors in removal callbacks propagate similarly as non-fatal errors. Errors thrown in either case propagate up the tree, and for removal callbacks, if an error propagates into a non-removed node, it becomes fatal. (Or to put it another way, it's fatal if propagated from a non-removed IR node.)

> How can this be tracked without any explicit data?
>
> TODO

After each render pass, the callback lists are then iterated. Remove callbacks are moved to the front, and non-remove callbacks are invoked. After completion, the list is then truncated and persisted.

> Note: [while it could be sorted first efficiently](http://hjemmesider.diku.dk/~jyrki/Paper/KP1992bJ.pdf), this won't likely provide significant gains except with collections much longer than what would generally occur in practice.

## Types

*TODO: ensure it's clear that empty fragments are converted to holes.*
*TODO: ensure it's clear that state vnodes contain the child vnode count + 1 children, with the last corresponding to their rendered output.*

There are 11 internal types, and these do *not* align one-to-one with received types - these are meant for fast internal processing. Here's the data for each internal type:

- Fragment:
    - Identity: `undefined`
    - Reference: `undefined`
    - Value: `undefined`
    - Children: `undefined` if empty, or an array of children if non-empty

- Element:
    - Node count: always 1
    - Identity: tag name
    - Reference: element reference
    - Value: attributes

- State:
    - Identity: `undefined`
    - Reference: `undefined`
    - Value: component info object
    - Children: single component instance as non-array

- Link:
    - Identity: current identity
    - Reference: `undefined`
    - Value: `undefined`

- Keyed:
    - Identity: `undefined`
    - Children: map of key -> child IR

- Trust:
    - Identity: text string
    - Reference: `undefined`
    - Value: `undefined`
    - Children: `undefined`

- Component:
    - Identity: component reference
    - Reference: component `info.ref`
    - Value: component `info` object
    - Children: single component instance as non-array

- Portal:
    - Identity: node reference
    - Reference: node reference
    - Value: attributes

- Transition:
    - Identity: `undefined`
    - Reference: `undefined`
    - Value: transition options

- Text:
    - Identity: `undefined`
    - Reference: text node
    - Value: text string

- When caught:
    - Identity: `undefined`
    - Reference: parent catch's IR node
    - Value: callback

> Note regarding reference nodes: Nodes that have applicable references always store them in the reference slot, never any other slot. This ensures it's trivial to retrieve it. Others may elect to abuse it for other reasons.
>
> Why do keyed fragments use a map for their children and not an array? Using a map and mutating it on update with an otherwise phased approach turns an O(n log n) operation into an O(1) amortized one. And for obvious reasons, this is far quicker. Note: see [this bug](https://github.com/MithrilJS/mithril.js/issues/2618) for ideas on how to implement it.

### Wait, how does this align with the hyperscript API?

It's clearly not the same, and both the hyperscript API and IR lowering make a few optimizations. And yes, it looks very different. Here's how the IR nodes map back to hyperscript:

- Fragment: `[...]`, holes, and things optimized to holes
- Element: `m("foo", attrs?, ...children)`
- State: `m.state(info => result)`
- Link: `m.link(id, ...children)`
- Keyed: `m.keyed(coll, selector, view)`
- Trust: `m.trust(str)`
- Component: `m(Comp, attrs?, ...children)`
- Portal: `m(elem, attrs?, ...children)`
- Transition: `m.transition(opts, elem)`
- Text: `"..."`, `1`, etc.
- When caught: `m.whenCaught(callback, ...children)`

Here's what's optimized to holes:

- Empty arrays (IR-level)
- Empty strings (IR-level)
- `m.RETAIN` on first render (IR-level)
- `m.link` with all children being either holes, empty arrays, or empty strings (hyperscript-level)
- `m.each` with all children being either holes, empty arrays, or empty strings (hyperscript-level)
- `m.whenCaught` with all children being either holes, empty arrays, or empty strings (hyperscript-level)
- Empty `m.trust` (hyperscript-level)
- Empty portals (hyperscript-level)

It still generally resembles the structure, but most the redundancy is stripped away.
