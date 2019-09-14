[*Up*](README.md)

# Vnodes

- Holes: `null`, `undefined`, and booleans
- Text: anything other than `null`, `undefined`, a boolean, or an object
    - Note: this uses `String(value)` to coerce, so symbols *are* converted to a string first.
- Fragments: arrays
- Retain: `m.RETAIN`
- Capture points: `m.capture(ref)`
- Attribute objects: any object without a `%type` property, like `{type: "text"}`.
- Elements: `m("tag", ...children)`, `m("tag.sel", ...children)`
    - CSS selectors are allowed, with the same syntax as current Mithril (mod a few caveats).
- Components: `m(Comp, ...children)`
- Link points: `m.link(id, ...)`
    - `id` - The identity to link the fragment to.
- Keyed lists: `m.each(list, key, view)`
    - `key: (x, i, list) => key` - Get the property key
    - `view: (x, i, list) => vnode` - Get the corresponding vnode
    - `key` and `view` can both be property keys, as sugar for `x => x[key]`
    - `list` must be an array.
    - Key and vnode lists are read and converted eagerly to arrays.
    - Keys are coerced to property keys on storage.
    - Keys are read in full before each body vnode.

### JSX

JSX works similarly to the above, but they just use interpolations for the special vnodes like `m.capture` and `m.each`. Note that spread attributes are rendered to normal children, so if `attrs` in `{...attrs} on={{click: whatever}}` has an `onclick` handler, it'll get installed alongside `onclick` and separately so. This also works for vnodes like `m.capture` - you can use it like `{...m.capture(ref)}`

This will require a custom JSX plugin, but mainly for the attributes handling part (It needs to be static for sensible semantics) and for setting the `is` value correctly. Note that the `is` value must always be static to be used correctly.

### Selectors

Selectors are mostly the same, but the tag name is now always required.

- Add class name: `m("div.foo")` → `<div class="foo"></div>`
- Set ID: `m("div#foo")` → `<div id="foo"></div>`
- Set attribute: `m("div[attr=value]")`, `m("div[attr='value']")`, `m('div[attr="value"]')` → `<div attr="value"></div>`
- Namespaced tag name: `m("ns:elem.foo")` → `<ns:elem class="foo"></ns:elem>`
    - This just falls out of the grid. Tag names can contain any character other than `.`, `#`, `[`, `]`, or whitespace.
- Escape special character: `m("com\\.example\\.View")` → `<com.example.View></com.example.View>`
    - Useful when dealing with XML.
    - You can escape any escapeable character.
- Set `is` value: `m("p[is=custom-elem]")` → `<p is="custom-elem"></p>`
    - Note: this has special behavior. It not only sets the `is` attribute, it also is read directly and saved as the `is` value to pass to `document.createElement`.
    - Internally, the tag is stored as `["p", "custom-elem"]` in this case.

There's three reasons I mandate this:

- It's one of the biggest stumbling blocks people have had with selectors. I see this as a frequent stumbling block that people write `m(".foo")` instead of `m("span.foo")` and wonder why things aren't working. The implicit default clearly is tripping people up, and the common case is only really saving 3 characters for something that you're more often changing than writing to begin with. (Hyperscript isn't exactly Emmet.)
- It avoids the question of what to do with `m("")` - if you follow the rules logically, it's equivalent to `m("div")`, but intuitively, for many, it's equivalent to `null`.
    - Relevant GitHub issue: [#723](https://github.com/MithrilJS/mithril.js/issues/723)
    - Relevant Gitter discussion: [11 Dec 2015](https://gitter.im/mithriljs/mithril.js/archives/2015/12/11), [12 Dec 2015](https://gitter.im/mithriljs/mithril.js/archives/2015/12/12)
- It's less implicit information you have to keep in mind and infer. If it says `div`, you know at a glance it's a `<div>` that it renders to. 99% of development isn't writing, but reading, and that "at a glance" information is incredibly valuable to have. I find myself, as a Mithril maintainer, taking twice as long to process `m(".widget")` than `m("button.confirm")` or even `m("div.widget")`. Even though it's still pretty quick for me, I have to stop and mentally reparse after reading the tokens (the implied `div` in `div.widget` rather than just being decorated `widget`) as my brain reads the word before realizing that's the class name and not the tag name.

One other obscure bit: you can currently include spaces on either side of the `=` in `[key=value]`, but this is going away due to lack of use. (This aligns better with the CSS spec and is otherwise just all around useless.)

## Low-level

Each of these are normalized to a low-level representation, where non-holes have three properties: `%type`, `a`, and `b`. The first, `%type`, is used to both differentiate vnodes from other objects and to tell what kind of vnode it is.

And here's how each type is represented:

- Holes, empty fragments: `null`
- Retain: `Vnode.create(0, void 0, void 0)`
- Attribute: `Vnode.create(1, attrs, void 0)`
    - `attrs: {[key: string]: any}` are the attributes.
- Text: `Vnode.create(2, text, void 0)`
    - `text: string` is the text contents.
- Fragment: `Vnode.create(3, void 0, children)`
    - `children: Child[]` is an array of vnode children.
- Element: `Vnode.create(4, tag, children)`
    - `tag: string` is the element tag name.
    - Customized builtins' `is` values are specified by passing them as an array, like `["p", "custom-name"]`.
    - `children: Child[]` is an array of vnode children.
- Component: `Vnode.create(5, tag, children)`
    - `tag: Component` is the component type reference.
    - `children: Child[]` is an array of vnode children.
- Link: `Vnode.create(6, id, children)`
    - `id: any` represents the current state. This can be any value, and is compared via `SameValueZero`.
    - `children: Child[]` is an array of vnode children.
- Keyed: `Vnode.create(7, keys, bodies)`
    - `keys: any[]` contains the property keys for each body. In IE, keys are treated as property keys for performance reasons, but in modern browsers, `Map`s are used, so any reference type can be used in them.
    - `bodies: Child[]` is an array of vnode children where each child corresponds to the key of the same index in `keys`.
- Capture: `Vnode.create(8, ref, void 0)`
    - `ref: {current: any}` is a reference.
- Static hint: `1 << 7` set in first argument

When the static hint bit is set, the following things happen on update:

- The tag is never diffed
- On elements, fragments, components, and bind vnodes:
    - Children are assumed to be fully normalized
    - Children are assumed to never change primitive type
- On other vnode types, it turns it into basically a retain vnode.

This exists as an optimization for tooling to leverage, but it's optional. Tooling should also consider conditionally using `m.RETAIN` for deeply static trees instead of the above.

Keyed vnodes don't include the callback their vnode factory includes, for faster processing.

Note that these vnodes are immutable. You can feel free to reuse them, and unlike in most other frameworks, these are *very* lightweight. For contrast:

- React, which uses a persistent DOM, features 6 fields in production mode.
- Inferno, which does mostly the same thing we do in v2, features nine.

Super lightweight DOM nodes will help keep memory usage and churn down a lot, and engines are really good at optimizing for small objects that comprise 99% of object use anyways. And in the case of Mithril views, this could mean you're generating a fraction of the GC churn each render.

### Utilities

There's a few utilities to interpret vnodes, in a way that is a little more semantically useful.

- `Vnode.isNormalized(vnode)` - Return whether this is a normalized vnode.
    - This doesn't check that the vnode is recursively normalized, just normalized at the top level.
- `Vnode.normalize(vnode)` - Normalize a vnode recursively into the low-level representation, without resolving it.
    - This doesn't attempt to normalize the children of vnodes where `Vnode.isNormalize(vnode)` returns `true`.
- `Vnode.isStatic(vnode)` - Return whether this vnode has the static hint bit set.
    - This works with non-normalized vnodes as well.
- `Vnode.getTag(vnode)` - Returns the tag name for standard elements, an array of `[tag, isValue]` for customized builtins, component reference for components, or a special tag string for other types. This only works with normalized vnodes. Here's what it returns for all the other types:
    - Holes and empty fragments: `"#empty"`
    - Retain: `"#retain"`
    - Attribute: `"#attrs"`
    - Text: `"#text"`
    - Fragment: `"#fragment"`
    - Link: `"#link"`
    - Keyed: `"#keyed"`
    - Capture: `"#capture"`
- `Vnode.getData(vnode)` - Get the data part of the vnode.
    - Attribute: returns the attributes object
    - Text: returns the text string, coerced if the vnode is non-normalized.
    - Link: returns the link ID
    - Keyed: returns the key list
    - Capture: returns the ref to assign to
    - All other types: returns `undefined`
- `Vnode.getChildren(vnode)` - Get the children part of the vnode.
    - Fragment: returns the fragment children
    - Element: returns the element children
    - Component: returns the component children
    - Link: returns the linked child list
    - Keyed: returns the list of child bodies
    - All other types: returns `undefined`

Each of these work both on normalized and non-normalized vnodes to equivalent effect.

## Attributes

Attribute vnodes represent attributes, and you can use them literally. They're merged as they're found, and are resolved and applied while inititalizing the relevant parent.

Note that attribute vnodes cannot be returned from keyed fragments except nested in elements or components, and an error will be thrown from that vnode if such an attempt is made. (In general, it doesn't make sense anyways.) However, lifecycle vnodes can still be used in them.

`class:` and `style:` attributes would support an object of booleans, merged with previous class names/style properties instead of simply overwritten. (A class is rendered if it's present and all conditions on it are truthy.) Class strings are sugar for just `class: [classString]: true`.

`on:` members support both functions and `[options, callback]` pairs as event types, where `options` is passed to `addEventListener` as the third parameter. (Only capture/non-capture needs tracked for subscription.) By default, event listeners are added via `{passive: true, capture: false}` if event listener options are supported, `false` otherwise. (This helps with performance, since few listeners ever cancel their input aside from buttons and some form submissions.) Note: I don't merge event listeners - they're added in raw form and diffed as normal.

Only functions are supported for event listeners, as this no longer supports classes as components. They're called as `on.event(value, capture)`, where `value` is the received event value (a DOM event for DOM vnodes) and `capture` is a capture object. If a promise is returned and it rejects, this catches that and treats it as an error.

`capture` objects have a few methods:

- `capture.event()` - Invoke `ev.preventDefault()` + `ev.stopPropagation()` if it's a DOM event, have the corresponding `attrs.on.event(...)` call return `false` if it's a user event.
    - This does not prevent subsequent events from running, but they can check for previous capture via `capture.eventCaptured()`
- `capture.eventCaptured()` - Returns `true` if the event was captured, `false` otherwise.
- `capture.redraw()` - Skip the redraw.
- If a listener throws an error or returns a promise that rejects, the error propagates from the component that created the listener, *not* from the component the event was fired from. (Makes for easier, more intuitive error handling.)

## Refs

The `vnode.dom` from v1/v2 is replaced with refs here, which you create with `m.ref(init = undefined)` and capture via the vnode `m.capture(ref)`. Refs are simple `{current}` objects that let you pull out a given vnode into a given scope, and they're useful for DOM manipulation. `m.capture(ref)` captures the ref of the parent it's used as a child of, and in components, it works as if it were just substituted there at that parent position.

It may sound like it's bound to get unwieldy, but it actually simplifies and streamlines some things. It's pretty easy to get right, and pretty simple to understand, especially since functions aren't involved aside from the various controller lifecycle hooks.

## Why are keys different?

Well, keys are currently used in one of two ways in nearly every virtual DOM library:

- A list of entries you need to iterate, where you need to track their identity even if they move.
- As a means to manually force a subtree to be replaced.

I decided to separate these out, because of two issues:

1. People have a habit of overusing keys, and `m.link(id, ...children)` makes it much clearer it's about linking an identity to a subtree. Been fighting this a lot lately in the Gitter chat room as well as in a few recent issues.
2. It's generally the wrong thing to do to key *some* but not *all* of a keyed list, and me adding that check in Mithril has caught a *lot* more problems than it caused based on all the feedback I got. If you really intend to have separators, you can figure that out manually using an index, but it's such a niche use case to want to interleave keyed and unkeyed subtrees it shouldn't be supported in Mithril itself. If you really need that, fork Mithril to do what you need.

And in addition, [this loop](https://github.com/mithrilJS/mithril.js/blob/db277217f88d293aa14154c8f0017675ffe94a9c/render/vnode.js#L16-L23) is not something I want to keep around in a framework. It's ugly, it's slow, and it's just a band-aid to protect users against a common user bug. By splitting these two out and changing how keyed fragments are built, it solves several problems:

- Instead of having to check for all keyed/unkeyed, it's literally impossible by design to make that mistake.
- `m.link` makes it easy and clear when you're binding a state to a subtree, so it's easy to simply swap that out for something else.
- There's nothing to check to see if it's a keyed fragment or an unkeyed one besides just testing a simple integer ID, mitigating most of the performance cliff and complexity associated with it.
- It's much less of a footgun to just `m.link` everything than it is to add `key:`s to v2 fragments, meaning I'll end up with a lot fewer people confused about it.

## Why are attributes a type of vnode?

The benefits of this aren't immediately obvious, I know. But it does lead to some radical new paradigms:

- You want to include move transitions? Just add a `transition("list")` to it with appropriate CSS for `.list-in`, `.list-out`, and `.list-move`.
- You want an `m("a")` or `m("button")` to route to a link on click? Use a simple `linkTo("/route")`.
- You want an `m("a")` or `m("button")` to act as a back button? Just drop in a `linkBack()` or `linkTo(-1)`. It's literally that simple.

## Why are event listeners specified as properties of an object in an `on` attribute, instead of just using `onevent`?

A few reasons:

1. It's easier to develop types for. [TypeScript doesn't currently provide a way to match type keys starting with `on`](https://github.com/Microsoft/TypeScript/issues/6579), and Flow also lacks similar functionality.
2. It's easier to iterate and enumerate.
3. It's easier to check for. It's just a simple `key === "on"`, a two-byte string engines typically intern, and small strings like that are themselves usually almost instantly checked to begin with, even if `key` is `"o" + "n"`, a cons string.
