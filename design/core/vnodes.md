[*Up*](README.md)

# Vnodes

### Hyperscript API

The primary hyperscript API is still exposed as usual via `mithril/m` and `Mithril.m` in the core bundle.

### Vnode types

- Hole: `null`/`undefined`/`true`/`false`
- Element: `m("div", ...)`
	- `xmlns` sets the raw namespace to construct this with. For the DOM renderer, this by default just follows HTML's rules regarding namespace inference. Note that this sets the implicit namespace to use for child nodes, too.
	- Event handlers can be specified via `on: [receiver, ...events]`, where each event is defined via `"name"` or `["name", opts]`.
	- Attributes on element vnodes other than magic attributes *may* be set to streams rather than raw values. This includes `on:`, but not child event listeners within it. This enables updates without actually performing a full diff, which is significantly faster. (We'll blow benchmarks out of the water that way, but it also just makes more sense in this model.) Note that this doesn't carry over to components.
	- This follows mostly the same hyperscript API as usual.
- Fragment: `[...]`, `m("#fragment", (context) => children)`
	- The second form generates its child during the child's render time.
- Keyed: `m("#keyed", {of: coll, by: (x, i) => key}, (x, i) => child)`
	- This enables easy keyed fragment rendering
	- Children are generated via a child function, as if via an implicit `map`.
	- The reason for doing it this way is because it's a bit lower in memory overhead while having mostly negligible impact in performance.
	- This also removes the need for a magic `key` attribute, one less thing to special-case for. It also makes it impossible to have a child without a corresponding key, something I've seen come up a few times.
	- For ease of use and since it's such a common use case, you can pass `by: "key"` as sugar for `by: (x) => x.key`. (It's also optimized for internally.)
- Dynamic: `stream`
	- Any function is considered a dynamic vnode.
- Text: `"..."`
	- Any primitive non-reference type not representing a hole is considered a text node, including numbers.
- Catch: `m("#catch", (errors) => child)`
	- `errors` is a stream that asynchronously emits every exception from the returned subtree that propagates to Mithril's renderer from user code. This includes errors in streams as well as errors returned from event handlers within it.
	- This exists mainly for error reporting, but can be used in other ways.
	- You can propagate an error upward by rethrowing it.
	- When an error propagates past a subtree, that subtree is synchronously removed with inner `done` callbacks invoked. (Errors in those are added to the error list, and the list will be eventually rethrown in a property of a synthetic error.)
- Component: `m(Component, ...)`
	- `on:` can be set to a stream to update the observed event list. This is for consistency with element vnodes, but other attributes are not similarly normalized. (Components can leverage that for various optimizations.)

### JSX

JSX support uses a different function, `Mithril.jsx(tag, attrs, ...children)`. It's resolved slightly differently, and is specialized for JSX specifically.

When using JSX, you should use `@babel/plugin-react-jsx` and enable the following options:

- `pragma: "Mithril.jsx"`
- `pragmaFrag: "'#'"`

For lazy fragments and other vnodes that aren't either components or element tag names, you should use `Fragment`, `Keyed`, and `Catch`, exported from `mithril/m`. But in addition, you should set the following Babel JSX plugin options when using `@babel/preset-react`:

- `pragma: "m"`
- `pragmaFrag: "'#fragment'"`

Or if you're using the `@jsx` and `@jsxFrag` special comments, you should use `/* @jsx m @jsxFrag "#fragment" */`.

### Attributes

Attributes are the bread and butter of element manipulation. These are how things actually get reacted to, other than children. For DOM vnodes, this is how you update values, classes, and the like. For components, this is how you pass data and callbacks to them.

There are six special attributes:

- `tag` - This is used to tell vnodes apart from attributes objects.
	- Since `children` causes a value to be assumed to be attributes independent of the existence of this property, you can pass this as a literal property by also including a `children: []` object.
- `ref` - This allows accessing the underlying DOM instance or provided component ref of a particular component or vnode.
- `children` - This is the attribute's list of children.
	- If this attribute exists, the object is assumed to be an attributes object regardless of whether `tag` exists.
	- Children are always normalized to an array, even if just an empty array and even if it's for a component vnode. Note that the selector and attributes still take precedence over any children parameters.
	- For component vnodes, they're only special in that they're guaranteed to exist as an array.
- `xmlns`, special for element vnodes only and unique to the `mithril/render` renderer, sets the raw namespace to construct this with. For the DOM renderer, this by default just follows HTML's rules regarding namespace inference. Note that this sets the implicit namespace to use for child nodes, too.
- `is`, special for element vnodes only and unique to the `mithril/render` renderer, defines the `is` value to construct the vnode with. The `is` value is also diffed as part of the element vnode's type, along with the tag name and `key`.
- `on` subscribes and tracks events as per the next section.

On DOM elements, attributes other than the above *may* be set to streams, in which they're updated with the value of each stream emit. This simplifies a lot of attribute binding for DOM elements. Also, by side effect, it sidesteps a lot of our diff calculation overhead, but this isn't why I chose to allow this. It gives us much of the benefits of a system like Glimmer's pre-compiled VM architecture without the tooling overhead.

Note that the hyperscript API always normalizes attributes to an object, even if it's an empty one. The renderer expects and assumes this.

### Events

Events are dramatically changed, to be something much more easily scaled.

They are specified via `on:` attributes, where each event is defined via `"name"` or (for element vnodes) `["name", opts]`.

There are a few rules about how `receiver` and `opts` are interpreted:

- If `receiver` is a function, it's called on each received event as `receiver(event, capture)`. The return value is entirely ignored, so you can freely make them `async` when convenient.
	- Execute `capture()` for DOM events to invoke `ev.preventDefault(); ev.stopPropagation()`
	- Execute `capture()` for component events to have the parent `emit` calls return `true` to denote them as "prevented".
	- Components can also receive a boolean return value when invoking event handlers, `false` if it's considered prevented or `true` otherwise.
- No other types of `receiver` are supported. Since components can't be classes, `handler.handleEvent(ev)` support is no longer broadly useful and so I plan to drop it.
- For element vnodes, `opts` can be any value `addEventListener` and `removeEventListener` accept, including `{passive: true}`, `{capture: true}`, and `true`. If not present, it defaults to just `false`.
- If you need to know the type, just inspect `event.type`. It's there, and you don't really need to do anything. For components, they have to specify it anyways when emitting events - an error is thrown on their end if they don't (and your receiver doesn't get called).

A utility method in `mithril/m` exists, `withScope(receiver, scope)`, to help scale this a little more cleanly. It invokes `receiver` with `{type, scope, value}`, where `type` is the original type, `scope` is as specified above, and `value` is the original received event itself.

Components emit events through a second parameter `emit` that wraps all the nasty boilerplate transparently.

- `emit("event")` - Whether a particular event type is being listened for.
- `emit({type: "event", ...value}, capture = noop)` - Emit an event. This returns `undefined`, and you can observe capture by passing `capture`.
	- This is intentionally aligned with the event receiver prototype, so you can easily delegate events by passing this as an event receiver. It's perfectly legal to pass `on: [emit, ...events]` as an element or component attribute.

Components also receive the raw `on` attribute itself. This is mostly pragmatic: I can just pass the raw attributes from `vnode.attrs` directly to the component, something that's a bit faster than trying to copy everything without `on`, and it opens the door for more advanced event handling use cases in case the `emit` API isn't sufficient.

#### Why change the event receiver model?

It's all-around more scalable and it enforces a much more regular, streamlined data flow. I've already had success with the pattern of `switch (event.type) { ... }` with a single locally-centralized listener, both in front end programming, backend programming, and even command-line applications: it streamlines event handling logic in even the most complicated of cases where you're listening to 15 different events on a single element. When you add paths like via `withScope`, it then can adapt to child elements, and it even helps with that. Together, it lets you use a single event listener with all logic wrapped into it.

In general, it converts spaghetti event code into centralized data-driven code and makes it much easier to follow. At small scale in demo projects, this does practically nothing, but it shows its value the more event handlers you have in a single component. You might think this is limited to form components and the like, but I assure you the benefits extend elsewhere, too. People push for small components, but this really does alleviate much of the use for that, by making one of the most difficult parts of larger components, control flow, much more manageable.

And finally, I've seen it's a *very* common beginner and intermediate developer mistake to fumble with trying to figure out how to send data between child and parent component. Making events use a centralized handler with a centralized means of sending data back to the parent makes the control flow much more explicit here, so it's much clearer how those LEGO bricks fit. There really is no question from the API itself the correct way to handle events, and it's much more intuitive how that unidirectional data flow works.

As an added bonus, I can avoid all the polymorphism when it comes to event diffing and event invocation, and it encourages people to keep their event list static and put all the dynamic stuff in the receiver. So I can get away with sloppier heuristics that make it much faster to check at the cost of slower updates. It leaves the common case faster.

### Refs

Refs are requested by simple `ref` attributes: `ref: (elem) => ...`.

- For element vnodes, `ref` callbacks are scheduled to be run after all render tasks complete for this frame. They are invoked with the backing DOM node.
- For unkeyed fragments, `ref` callbacks are scheduled to be run after all render tasks complete for this frame, They are invoked with the array of DOM nodes encapsulated by that fragment and all child fragments and components recursively, but not recursively through child elements.
- For all other element types, including components, `ref` attributes carry no special semantics and `ref` callbacks are *not* scheduled. If you want to provide a `ref` for a component, invoke it directly in the component body itself.
	- Intentionally, keyed fragments are left out. It's not that hard to wrap it in an unkeyed fragment which has to track the unit anyways.

Intentionally, I organized it to where refs are for only vnodes that encapsulate single units.

- Elements encapsulate only themselves, so it makes perfect sense for a ref to return that.
- Unkeyed fragments encapsulate single subtrees, so it makes sense for a ref to return the list of active nodes.
- Keyed fragments encapsulate multiple subtrees with an associated list of keys, so although the obvious choice is to have it return the list of child nodes like with unkeyed fragments, it's unclear whether the keys should be included or not. (Both ways are intuitive.)
- Catch fragments encapsulate a single subtree but also the errors generated within it. Like with keyed fragments, the obvious choice with catch fragments is to have it return the list of child nodes, but it's not clear whether errors should be included in the ref somehow or not.
- Holes, text, and dynamic vnodes obviously don't have the attributes to add a ref.
- Components lack attributes directly, but I leave it up to the component to determine whether something has a ref to send or not.

Notes:

- Refs are somewhat different from React's:
	- Refs are always invoked on every update that reaches them, as they're not simply exposure mechanisms but also control mechanisms.
	- [React cares about ref identity](https://reactjs.org/docs/refs-and-the-dom.html#caveats-with-callback-refs), but this complicates the model a lot, especially when it's designed only for exposure.
	- You can see refs in action in [the TodoMVC example](https://github.com/isiahmeadows/mithril.js/blob/redesign/examples/todomvc/view.mjs).
- Technically, I could just provide `vnode.dom` + an `oncreate`/`onupdate` equivalent instead of `ref`, but there's four three reasons why I'm not:
	1. It's generally poor practice to try to mutate the DOM outside of event handlers (which provide it via `ev.target.value`) or a batched request. Forcing batching also keeps performance up and running.
	2. It makes it impossible to access an uninitialized element, simplifying types and avoiding potential for bugs.
	3. It complicates access for simpler cases.
	4. 1 hook is better than 2. I'd need a hook for `oncreate`/`onupdate` anyways, so it's much simpler to do it this way.

### Selectors

Selectors are mostly the same, but the tag name is now always required.

- `m(".class")` &rarr; `m("div.class")`
- `m("#id")` &rarr; `m("div#id")`
- `m("[attr=value]")` &rarr; `m("div[attr=value]")`

There's three reasons I mandate this:

- It's one of the biggest stumbling blocks people have had with selectors. I see this as a frequent stumbling block that people write `m(".foo")` instead of `m("span.foo")` and wonder why things aren't working. The implicit default clearly is tripping people up, and the common case is only really saving 3 characters for something that you're more often changing than writing to begin with. (Hyperscript isn't exactly Emmet.)
- It avoids the question of what to do with `m("")` - if you follow the rules logically, it's equivalent to `m("div")`, but intuitively, for many, it's equivalent to `null`.
	- Relevant GitHub issue: [#723](https://github.com/MithrilJS/mithril.js/issues/723)
	- Relevant Gitter discussion: [11 Dec 2015](https://gitter.im/mithriljs/mithril.js/archives/2015/12/11), [12 Dec 2015](https://gitter.im/mithriljs/mithril.js/archives/2015/12/12)
- It's less implicit information you have to keep in mind and infer. If it says `div`, you know at a glance it's a `<div>` that it renders to. 99% of development isn't writing, but reading, and that "at a glance" information is incredibly valuable to have. I find myself, as a Mithril maintainer, taking twice as long to process `m(".widget")` than `m("button.confirm")` or even `m("div.widget")`. Even though it's still pretty quick for me, I have to stop and mentally reparse after reading the tokens (the implied `div` in `div.widget` rather than just being decorated `widget`) as my brain reads the word before realizing that's the class name and not the tag name.

One other obscure bit: you can currently include spaces on either side of the `=` in `[key=value]`, but this is going away due to lack of use. (This aligns better with the CSS spec and is otherwise just all around useless.)

### Why keep vnodes JSON-compatible?

This is in large part due to disagreement with [React's decision to block it](https://overreacted.io/why-do-react-elements-have-typeof-property/) somewhat. They make security claims, but I'm not convinced they're serious in any remotely sane set-up:

- They note that it's *very* difficult to block arbitrary JavaScript in general and that their defense could still be penetrated in many circumstances.
- Some of the potential vulnerabilities they claim exist are almost certainly *not* exploitable in practice.
	- The section on "[...] if your server has a hole that lets the user store an arbitrary JSON object while the client code expects a string, [...]" is itself fairly niche, and even in this case, you almost always do further processing before rendering the value.
	- It notes pretty clearly it *doesn't* protect against things like `href: "javascript:doSomethingReallyEvil()"` or spreading untrusted attributes.
	- Most of the hypotheticals are just about things frameworks already address, like unescaped strings and the like.
- The obvious case of an object without a `.tag` is already rejected for reasons other than this, but it'd also catch 99% of the issues that'd really occur in practice, including some I've encountered personally.

### Dynamic vnodes

Dynamic vnodes are just [streams](#streams) which receive an extra `context` parameter - yes, really. This gives you a handle to update them manually, but easily. Note that trees can only be patched through the use of dynamic vnodes.

When you "replace" a dynamic vnode, it detaches the previous dynamic vnode's tree before initializing the new one, but unsubscribes from it *after* the new one is first rendered. I can do this because I convert updates from invoking a `render` method to just emitting through a stream.

In case you're curious, yes, this effectively works as an explicit one-way binding mechanism.

- This is for when you need a fragment you can update manually.
- This simplifies a few things.
- This makes certain auto-binding patterns easier to specify.
- This can provide some prop-like magic behavior without actually being a significant maintenance or boilerplate problem.

Note: after emitting a dynamic vnode, if it emits again while its children are being rendered, it schedules a new render with the new children in the next frame. This can occur if a `create` callback in `m("#fragment", {create})` causes the dynamic vnode containing it to return a new vnode, causing an update of this very vnode.

### Rendering

Rendering is simple: `o.next(vnode)`.

- This schedules a subtree redraw for the relevant dynamic vnode.
- `vnode` is the children to write.
- This commits asynchronously, but is *not* guaranteed beyond that.
- Return `o.next(() => ...)` if you want to lazily compute a subtree.
- Use a `ref` if you want to await commit.
	- This is intended to support things that require [DOM calculation or similar](https://github.com/MithrilJS/mithril.js/issues/1166#issuecomment-234965960) immediately after rendering.

Async rendering frames operate in this order for each root being redrawn:

1. Update the root's subtree with the given updated trees. If a child has an updated tree after sending new attributes, that subtree is updated, too.
	1. Each update is attached to a fragment and added to the DOM immediately after this step.
1. Unsubscribe closed streams in order of appearance.
1. Invoke all vnode `ref` callbacks in order of appearance.

### Context

Lazy vnodes receive a context, useful for doing more advanced things that depend on what it's rendered with. There are two required properties:

- `context.isStatic` - `true` if the result is being rendered once to a serialized string, `false` otherwise. If this returns `false`, refs on primitive elements and fragments should call the ref with either `undefined` or no value at all.
- `context.type` - A descriptive string uniquely referring to this renderer. This doesn't need to be unique to all entry points, but only to the backing renderer itself - a native renderer should *not* return `context.type === "dom"`, for example.

Other renderers may choose to add other properties to this as they wish.

One case where this can prove useful is with integration with third party DOM libraries, when you need to *not* invoke their methods in server-side code. The data here is considered static and is almost always going to be global to that module.

Here's how it's set for the various core renderers:

- When `mithril/render` is used:
	- `context.isStatic` is set to `false`
	- `context.type` is set to `"dom"`
- When `mithril/render-html` is used:
	- `context.isStatic` is set to `true`
	- `context.type` is set to `"html"`
- When `mithril/render-vnode` is used:
	- `context.isStatic` is set to `true`
	- `context.type` is set to `"vnode"`

### What happened to lifecycle methods?

Those have been split into two parts:

- `oncreate`/`onupdate`/`onremove` - Lazy vnodes + refs
- `onremove` - Stream unsubscription, `attrs` completion.
- `oninit` - Just put the state in your stream/component/whatever.
- `onbeforeupdate` - If nothing changed, just don't update. If you'd like some sugar for this, there's a `distinct(stream, by?)` method in [the core stream utilities](../mvp-utils/stream.md) that you can use for equivalent effect.
- `onbeforeremove` - In the attributes, set an option to start the transition, then remove the vnode after it completes. [I do plan to expose a built-in utility for assisting with this](../mvp-utils/transition.md) as part of the MVP, and the hard part of doing this for lists is [another component I want to include](../future-utils.md#list-transition-api), just not required for the MVP itself.

It's worth noting we're currently the exception, not the norm, in baking async removal into core. Angular, React, Vue, and even Polymer require that async removal occurs with the explicit awareness of the parent. And it's not like we don't ourselves have catches in this: async removal only awaits the top-level vnode being removed. Anything else, even in Mithril, requires cooperation between parent and child.

The solution to async removal without framework support is through an intent system:

1. Set a flag on a component when you're about to remove it. That component should then do whatever it needs to do first, like toggle a class.
1. Once the component has done the necessary processing (like after the animation runs), it should invoke a callback to signal it's ready to be removed.
1. Finally, remove the node itself.
