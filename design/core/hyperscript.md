[*Up*](README.md)

# Hyperscript API

The primary hyperscript API is exposed via `mithril/hyperscript`.

It uses much of the same concepts from the existing hyperscript syntax, but with a few changes to match the new processing model and a few ties from functional programming.

## Vnode types

- Hole: `null`/`undefined`/`true`/`false`
- Element: `m("div", ...children)`
	- This follows mostly the same hyperscript API as usual.
	- Elements are detected via the presence of a `%type` property.
- Component: `m(Component, ...children)`
	- Same API concerns as elements generally, just without a possible selector.
- Attributes: `{key: value, ...}`
	- Attributes on element vnodes other than magic attributes *may* be set to streams rather than literal values. This enables updates without actually performing a full diff, which is significantly faster. (We'll blow benchmarks out of the water that way, but it also just makes more sense in this model.) Note that this doesn't carry over to components.
	- Set `rawAttrs:` if you want to set a special type or a special listener.
	- Components receive the values literally and merged.
	- These are detected by the lack of a `%type` property.
	- Note: `m("div", attrs, ...children)` is literally just a special case where the first child is an attributes vnode.
- Fragment: `[...children]`
- Config: `config((meta) => view)`
	- `meta` is various metadata.
	- `view` is the tree to render.
- Recover: `recover((errors) => newChild, ...children)`
	- If an error is caught from `child`, the function is called with a list of `errors` and its `newChild` is rendered.
	- Errors caught include both errors in streams and errors and rejections caught from event handlers. It does *not* include errors thrown from the function itself.
	- This is debounced until the next render as applicable, with all errors accumulated before calling it.
	- This exists mainly for error reporting, but can be used in other ways like with async network requests.
	- When an error propagates past a subtree, that subtree is synchronously removed with inner `done` callbacks invoked. If any of those throw, their errors are also added to the `errors` list.
- Keyed: `keyed(list, by: (x, i) => key, view: (x, i) => child)`
	- This enables easy keyed fragment rendering
	- Children are generated via a child function, as if via an implicit `map`.
	- `list` can be a stream emitting arrays, too, for ease of use.
	- The reason for doing it this way is because it's a bit lower in memory overhead while having mostly negligible impact in performance.
	- This also removes the need for a magic `key` attribute, one less thing to special-case for. It also makes it impossible to have a child without a corresponding key, something I've seen come up a few times.
	- For ease of use and since it's such a common use case, you can pass `"key"` as sugar for `(x) => x.key` for `by`. (It's also optimized for internally.)
- Dynamic: `stream`
	- Functions are assumed to be dynamic vnodes.
- Replace: `replace(child)`
	- This fails to match any previous type, thus reinitializing `child` on every patch.
	- A conceptual `m(Control, a("key", key), ...children)` could be as simple as `const Control = (attrs) => Stream.map(Stream.distinct(attrs, "key"), (a) => replace(a.children))`.
	- This returns the child directly if it's a replaced child.
	- This carries the same type as its child otherwise.
	- This is a decorator-like vnode, so it's intentionally not `m("something")`.
- Text: `"..."`
	- Anything that's a string, symbol, or number is viewed as text.
- Context: `context((context) => view | {context: newContext, view})`
	- This is for more advanced use cases like routing and state management, so you can do things like replay modified global state for testing.
	- `context` is a direct reference to a frozen object.
	- `newContext` is an object of zero or more context values to add, or `null`/`undefined` if you don't want to add any keys.
	- `view` is the tree to render, detected by either a function, a non-object, or an object with a `%type` parameter if passed literally.
	- Reading from and writing to this is intentionally somewhat unwieldy. Don't overdo it.
- Portal: `portal(elemOrSelector, ...children)`
	- This is for the special case of appending attributes to a specific global element, in a way managed by Mithril.
	- This can be useful for triggering global modals.
	- This does not support children.
- Set reference: `setRef(ref, ...children)`
	- This can only be used top-level in components.

Non-array object vnodes have a `%type` member, but the rest of the structure should be considered an implementation detail.

For an easier time checking simple stuff, there's two internal methods exposed as well:

- `isVnode(vnode)` exists to check if something is a vnode. It returns `true` if `vnode` is considered a vnode, `false` otherwise.
- `isHole(vnode)` exists to check if something is a hole. It returns `true` if `vnode` is considered a hole, `false` otherwise.

### JSX

The JSX API is similar to the standard hyperscript API, but uses a different entry point into the hyperscript factory, `jsx`. It also uses a dedicated Babel plugin, `@mithriljs/jsx-babel`, to compile the JSX - it doesn't compile directly to a JSX factory. The API is pretty similar, but has a few differences in the vnode syntax:

- Hole: `null`/`undefined`/`true`/`false`
- Element: `<div {...attrs}>{...children}</div>`
	- Attributes are passed as the first child vnode.
- Fragment: `<>{...children}</>`, `<Self {...attrs}>...</Self>`
	- The `Self` variant allows you to specify additional attributes.
	- Attributes are passed as the first child vnode.
- Config: `<Config view={(meta) => view} />`
- Recover: `<Recover with={(errors) => newView}>...</Recover>`
- Keyed: `<Keyed list={list} by={(x, i) => key}>{(x, i) => child}</Keyed>`
- Dynamic: `{stream}`
- Replace: `{replace(vnode)}`
- Text: `...` inside elements and fragments, `{"..."}` and similar
- Component: `<Component {...attrs}>{...children}</Component>`
	- Attributes are passed as the first child vnode.
	- Non-hole, non-attribute children are passed via the `children` attribute to components.
- Context: `<Context update={(context) => ({context: newContext, view})} />`
- Portal: `<Portal root={elemOrSelector} {...attrs} />`
- Attributes: inline in components or via `Self` attributes. Spread attributes are converted into literal children and delimit attributes objects, so do note that.

Each of these names, `Self`, `Config`, `Recover`, `Keyed`, `Context`, and `Portal`, all have corresponding `mithril/hyperscript` exports and special knowledge from the `jsx` factory.

## Attributes

Attributes are the bread and butter of element manipulation. These are how things actually get reacted to, other than children. For DOM vnodes, this is how you update values, classes, and the like. For components, this is how you pass data and callbacks to them.

There are a few special attributes:

- `onevent: (ev) => ...`, `onevent: [(ev) => ..., options = false]` - Set event listeners, optionally with options.
	- See [the events documentation](events.md) for how this would work.

- `afterCommit: (elem) => newAttrs?` - Specify a callback to be called after initialization. You can also specify new attributes to apply in this callback.
	- See [the events documentation](events.md) for how this would work.

- `children:` - This is the attribute's list of children.
	- If this attribute exists, the object is assumed to be an attributes object regardless of whether `tag` exists.
	- Children are always normalized to an array, even if just an empty array and even if it's for a component vnode. Note that the selector and attributes still take precedence over any children parameters.
	- For component vnodes, they're only special in that they're guaranteed to exist as an array.
	- Don't specify this directly - it's always ignored. Prefer actual children instead unless you're proxying attributes.

- `is:`, special for element vnodes only and unique to the string and DOM renderers, defines the `is` value to construct the vnode with. The DOM renderer uses this to create the element and properly subscribe for updates when the element isn't defined, and the string renderer needs this to be able to represent custom elements in rendered HTML. Note that this *must* be in the hyperscript selector or immediate children of the vnode, not nested in an array, to be read correctly - just the presence of `{is: ...}` is not sufficient.

- `class:`, special for element vnodes only and unique to the string and DOM renderers, can be set to an object of `{name: boolean | streamOfBoolean}` properties as well, for convenience. It also tries to use `classList` if it can.

- `style:`, special for element vnodes only and unique to the string and DOM renderers, can be set to an object of `{key: value}` properties as well, for convenience. It also tries to use the `style` object if it can.

- `rawAttrs:`, special for element vnodes and unique to the DOM and string renderers, lets you specify any raw attribute you normally couldn't otherwise. You can even specify literal `on${event}` strings within it, and it makes for a convenient escape hatch in JSX for other attributes that might be valid HTML/XML attribute names, but aren't valid in JSX itself. Individual members within it can also be streams, as can the entire object itself.
	- These are always interpreted as attributes and never properties. So if you have something normally interpreted as a property but the attribute has different semantics (something that may come up with poorly-designed custom elements), you can use this to escape out of it.
	- There's a reason why this isn't the default - don't use this as an idiomatic shortcut for just installing `on${event}` handlers, for instance. It *can* open you up to security issues and unexpected behavior, like `onclick: function () { count++ }` resulting in a `elem.setAttribute("onclick", "function () { count++ }")`, which is almost certainly *not* what you meant to do.
	- No equivalent exists for properties as the DOM renderer normally checks for properties first, and if you really do need to work around a special attribute, you can always use an [`afterCommit` listener](events.md). (The string renderer may need this for other reasons.)

On DOM elements, attributes other than the above *may* be set to streams, in which they're updated with the value of each stream emit. This simplifies a lot of attribute binding for DOM elements. Also, by side effect, it sidesteps a lot of our diff calculation overhead, but this isn't why I chose to allow this. It gives us much of the benefits of a system like Glimmer's pre-compiled VM architecture without the tooling overhead.

Note that the hyperscript API always normalizes attributes to an object, even if it's an empty one. The renderer expects and assumes this.

All valid literal attributes, unless otherwise specified, can have their values set to streams. These are the only exceptions:

- `children:` on element and component vnodes
- `is:` on element vnodes
- `afterCommit:` on element and component vnodes
- `onevent:` on element and component vnodes

Without an ancestor element or component vnode, only `afterCommit` can be specified. (It will receive `undefined` for the ref.) All other attributes are silently ignored.

## Selectors

Selectors are mostly the same, but the tag name is now always required.

- Add class name: `m("div.foo")` → `<div class="foo"></div>`
- Set ID: `m("div#foo")` → `<div id="foo"></div>`
- Set attribute: `m("div[attr=value]")`, `m("div[attr='value']")`, `m('div[attr="value"]')` → `<div attr="value"></div>`
- Namespaced tag name: `m("ns:elem.foo")` → `<ns:elem class="foo"></ns:elem>`
	- This just falls out of the grid. Tag names can contain any character other than `.`, `#`, `[`, `>`, or whitespace.
- Set `is` value: `m("p[is=custom-elem]")` → `<p is="custom-elem"></p>`
	- Note: this has special behavior. It not only sets the `is` attribute, it also is read directly and saved as the `is` value to pass to `document.createElement`.

There's three reasons I mandate this:

- It's one of the biggest stumbling blocks people have had with selectors. I see this as a frequent stumbling block that people write `m(".foo")` instead of `m("span.foo")` and wonder why things aren't working. The implicit default clearly is tripping people up, and the common case is only really saving 3 characters for something that you're more often changing than writing to begin with. (Hyperscript isn't exactly Emmet.)
- It avoids the question of what to do with `m("")` - if you follow the rules logically, it's equivalent to `m("div")`, but intuitively, for many, it's equivalent to `null`.
	- Relevant GitHub issue: [#723](https://github.com/MithrilJS/mithril.js/issues/723)
	- Relevant Gitter discussion: [11 Dec 2015](https://gitter.im/mithriljs/mithril.js/archives/2015/12/11), [12 Dec 2015](https://gitter.im/mithriljs/mithril.js/archives/2015/12/12)
- It's less implicit information you have to keep in mind and infer. If it says `div`, you know at a glance it's a `<div>` that it renders to. 99% of development isn't writing, but reading, and that "at a glance" information is incredibly valuable to have. I find myself, as a Mithril maintainer, taking twice as long to process `m(".widget")` than `m("button.confirm")` or even `m("div.widget")`. Even though it's still pretty quick for me, I have to stop and mentally reparse after reading the tokens (the implied `div` in `div.widget` rather than just being decorated `widget`) as my brain reads the word before realizing that's the class name and not the tag name.

One other obscure bit: you can currently include spaces on either side of the `=` in `[key=value]`, but this is going away due to lack of use. (This aligns better with the CSS spec and is otherwise just all around useless.)

And finally, you can use `m("li > div.foo > span[key=value]")` to more easily specify simple nested DOM nodes, as sugar for `m("li", m("div.foo", m("span[key=value]", ...)))`. The specified attributes and children are applied to the last part, not the first. For example:

```js
m("div.container > div.user-view > div.user", {class: {selected}}, [
	m("div.user-name", "Name: ", user.name),
	m("div.user-location", "Location: ", user.location),
	m("div.user-active", "Active: ", user.active ? "Yes" : "No"),
])

// Or alternatively
m("div.container > div.user-view > div.user"
	, {class: {selected}}
	, m("div.user-name", "Name: ", user.name)
	, m("div.user-location", "Location: ", user.location)
	, m("div.user-active", "Active: ", user.active ? "Yes" : "No")
)
```

## Why keep vnodes JSON-compatible?

This due to moderate disagreement with [React's decision to block it](https://overreacted.io/why-do-react-elements-have-typeof-property/). They make security claims, but I'm not convinced they're serious in any remotely sane set-up:

- They note that it's *very* difficult to block arbitrary JavaScript in general and that their defense could still be penetrated in many circumstances.
- Some of the potential vulnerabilities they claim exist are almost certainly *not* exploitable in practice.
	- The section on "[...] if your server has a hole that lets the user store an arbitrary JSON object while the client code expects a string, [...]" is itself fairly niche, and even in this case, you almost always do further processing before rendering the value.
	- It notes pretty clearly it *doesn't* protect against things like `href: "javascript:doSomethingReallyEvil()"` or spreading untrusted attributes.
	- Most of the hypotheticals are just about things frameworks already address, like unescaped strings and the like.
- The obvious case of an object without a `.tag` is already rejected for reasons other than this, but it'd also recover 99% of the issues that'd really occur in practice, including some I've encountered personally.

Yes, you *could* have this vulnerability, but it would take more than lazy coding to get there. The 99% case of problems is already addressed by the fact you need a numeric `%type` field on top-level objects. Also, this actively prevents you from running code with parsed JSON input:

- `on${event}` handlers have to be functions for the DOM renderer.
- There's no means of specifying a trusted vnode in pure HTML.

The only security concern you need to worry about is `innerHTML`, and that only applies if you have no control over the JSON input itself. If this is a concern, deeply iterate the tree and run [DOMPurify](https://github.com/cure53/DOMPurify) over every `innerHTML` attribute of every element vnode whose type is a string.

## Dynamic vnodes

Dynamic vnodes are just [streams](#streams) - yes, really. This gives you a handle to update them manually, but easily. Note that trees can only be patched through the use of dynamic vnodes.

When you "replace" a dynamic vnode, it detaches the previous dynamic vnode's tree before initializing the new one, but unsubscribes from it *after* the new one is first rendered. I can do this because I convert updates from invoking a `render` method to just emitting through a stream.

In case you're curious, yes, this effectively works as an explicit one-way binding mechanism.

- This is for when you need a fragment you can update manually.
- This simplifies a few things.
- This makes certain auto-binding patterns easier to specify.
- This can provide some prop-like magic behavior without actually being a significant maintenance or boilerplate problem.

Note: after emitting a dynamic vnode, if it emits again while its children are being rendered, it schedules a new render with the new children in the next frame. This can occur if the `init` callback of `config` causes the dynamic vnode containing it to return a new vnode, causing an update of this very vnode.

## Components

- Components: `(attrsStream, events) => view`
	- `attrsStream` is a stream that emits each received attributes object.
		- On subscription, this invokes the observer's `.next` method.
		- On attribute update, this invokes all subscribed observers' `.next` methods.
		- On subtree removal, this invokes all subscribed observers' `.return` methods.
		- Invoking the returned `done` callback simply removes the subscription.
		- All observer methods are optional.
	- `events` is as documented [here](events.md#component-emitters).
	- `view` is simply a vnode. Conveniently, this *does* include streams itself.
	- You can set the reference by returning `setRef(ref, ...view)` instead. Note that by design, this does *not* let you change the ref - you can only mutate it.
- Components simply map attributes to a view. Mithril doesn't care about the attribute values themselves.
- Intentionally, components do have a friendly API that works even if you choose to use it not as a component.
- If you want to actually update the view, use a dynamic vnode
- Refs on components pass through to the component's body.
- If you want to remember attributes, store them in the state.
- If you want to remember old attributes or state, store them in the new state.
- Note: incoming vnode children are accessible via `children` attributes.
- Note: the attributes stream supports multiple observers. So you can do things like have multiple `Stream.map(attrs, ...)` in your view, without issue.

### Why separate the updating from components?

There's a few reasons:

1. Instead of component attributes being stored on the internal model, it's stored in a closure (the lazy or dynamic vnode's body) that implicitly gets replaced on update. In many cases, this provides a substantial memory win, since in practice, attributes are often not necessary.
2. This *only* updates when the attributes have to update. This cuts down *tremendously* on redraw times, so auto-redraws are never global.
2. Updating can happen anywhere, and it doesn't matter where it is as long as the tree is updated appropriately. This brings a lot of added flexbility.
3. Components now only serve one master: abstraction. Dynamic vnodes serve the single master of enabling subtree updates.

### Data flow model

If you've ever used [React Redux](https://react-redux.js.org/) or [Cycle.js](https://cycle.js.org) and you squint hard enough, you can see a mild resemblance [to](https://redux.js.org/basics/usage-with-react) [both](https://cycle.js.org/#-example). Yes, both of these are partial inspirations, but this is also partially just a superficial coincidence:

- Cycle.js joins streams, but it views components as more of a function of input sources to output sources. It draws a much greater inspiration from [the Model-View-Intent architecture](http://hannesdorfmann.com/android/mosby3-mvi-3), where the intents are derived from DOM events, the model receives intents and emits view states, and the view takes view states and returns a DOM.
- [Redux](https://redux.js.org/introduction/three-principles) is built on states, and together with something like React Redux, it inadvertently also implements a variant of the MVI architecture. You dispatch actions that act as "intents", reducers and stores work together as a conceptual "model", and the (usually React) component they plug into functions as the "view". Redux reducers also sometimes short-circuit the MVI loop by producing actions of their own through [Redux Thunk](https://github.com/reduxjs/redux-thunk), but this is uncommon and usually only exists for internal model updates.
	- I'm [not the](https://medium.com/@chessmani/yup-by-the-way-mvi-is-really-no-different-from-redux-its-just-a-different-name-which-i-wish-a3f3fe334fd9) [only one](https://github.com/mboudraa/flow/tree/eaf4973e798ea55f9b7eb07a37d4d9a2ff9a4513#a-few-words-about-reduxmvi) who's noticed Redux basically implements MVI, just using functions instead of objects.

But the data flow here is subtly different:

- Locally, components implement a loose, but reasonably well-defined MVI pattern to maintain state, using functional reactive programming to simplify the concept and plumbing.
	- "Model" = Component state (what state you define in the component)
	- "View" = What you render (what you return from the component)
	- "Intent" = Received events (your `receive` method handling any/all events)
	- Unlike in traditional MVI, you subscribe to UI intents in your view, not your model, and updated attributes are watched as an entirely separate type of "intent" as UI events. This makes it a little more optimizable and a little cleaner to separate.
	- It's not really possible to avoid this unidirectional intent-like data flow without things getting super awkward super fast, and that's by design.

- Components communicate to surrounding components as limited actors in a strict hierarchy, where:
	1. Components are only able to interact with their parent and children.
	1. The parent can send only a single type of message (attributes) to the child.
	1. The child can send multiple types of messages to the parent.

- Components communicate with external data models as usual in an unopinionated way. This can be traditional MVC, MVI/Redux, Meiosis, or whatever.

### Sugared components

This is exposed under named exports of `mithril/hyperscript` with each exposed in the core bundle.

- `closure((attrs, context, emit) => (attrs, prev) => view)`, exposed in the global bundle via `Mithril.closure`.
	- `attrs` - The current attributes.
	- `prev` - The previous attributes or `undefined` if it's the first render.
	- `emit` - The `emit` callback normally passed to components.
	- `context` - The redraw context:
		- `context.context` - Set to the outer `context`.
		- `context.redraw()` - Schedule an explicit async redraw for this component.
	- This wraps all event handlers, including component event handlers, to schedule an auto-redraw after the listener executes if you don't capture. It also wraps through keyed vnodes, config vnodes, and other similar vnodes, but it doesn't penetrate to child components.
	- You can pass it a useful name via `closure(name, init)`.

- `pure((attrs, prev, emit) => view)`, exposed in the global bundle via `Mithril.pure`.
	- `attrs` - The current attributes.
	- `prev` - The previous attributes or `undefined` if it's the first render.
	- `emit` - The `emit` callback normally passed to components.
	- Return `prev` directly if you want to retain the previous subtree.
	- This is just like `closure`, but sugars over attributes, too.
	- This does *not* schedule any redraws. If you need to redraw locally, it's not a pure component.
	- This is mostly sugar for `attrs => Stream.scanMap(attrs, undefined, (prev, attrs) => [attrs, view(attrs, prev)])`, but it doesn't have a dependency on [`mithril/stream`](mvp-utils#stream-utilities).

Note that this doesn't pierce through control vnodes and component vnodes to their children - it simply rewrites the returned vnode tree internally.

### Why?

Sometimes, it's easier to think procedurally and method-oriented and in super stateful, relatively static components like controlled forms and inputs, it's often more concise.

```js
// Native stateful component
const Counter = component(() => {
	return (o) => {
		let count = 0
		redraw()
		function redraw() {
			o.next([
				m("button", "-", {onclick() { count--; redraw() }}),
				m("div.display", count),
				m("button", "+", {onclick() { count++; redraw() }}),
			])
		}
	}
})

// Closure
const Counter = closure(() => {
	let count = 0
	return () => [
		m("button", "-", {onclick() { count-- }}),
		m("div.display", count),
		m("button", "+", {onclick() { count++ }}),
	]
})
```

Also, it's just generally useful when you store your model entirely separate from the component and access it directly, something not uncommon in simpler apps.

### Open questions

Is this a common enough *need* (not simply *want*) to include in the core bundle? I'm leaning towards a yes, since it's *sometimes* more concise and a little more streamlined. However, that "sometimes" is really an "almost never" in practice based on my experimentation, with most use cases being either forms, model-driven components, or something similarly stateful, self-contained, and non-reactive. I've only once in the `src/` or `examples/` folders needed this, and even in many of the cases you'd expect, it's neither more concise nor necessarily more readable.

It's worth noting that optimizing the vnode rewriting mechanism can get slightly arcane at times, so it's probably better that it remains in core.

## Rendering

Rendering is two-part, but not really that complicated:

1. Return the static tree to start
1. If you need to update parts of it, return streams emitting new trees.

These commit asynchronously, so if you want to run a callback on init, emit a `{view: child, init() { ... }}` object instead. This is intended to support things that require [DOM calculation or similar](https://github.com/MithrilJS/mithril.js/issues/1166#issuecomment-234965960) immediately after rendering to re-patch the tree.

Async rendering frames operate in this order for each root being redrawn:

1. Update the root's subtree with the given updated trees. If a child has an updated tree after sending new attributes, that subtree is updated, too.
	1. Each update is attached to a fragment and added to the DOM immediately after this step.
1. Invoke all `afterCommit` callbacks in order of appearance.
1. Unsubscribe closed streams in order of appearance.

## Context

Config vnodes receive a context instance, useful for doing more advanced things that depend on what context it's rendered in. This is something that *should* provide the same info on every render and ideally be the same instance. (This can change in nested contexts - specifically, the DOM and string renderers return a different non-required property for nested contexts.) It *may* provide a static instance for all renders, but this is not required. There are three main properties:

- `meta.isStatic` - `true` if the result is being rendered once to a serialized string, `false` otherwise. If this returns `false`, refs on primitive elements and fragments should call the ref with either `undefined` or no value at all.
- `meta.type` - A descriptive string uniquely referring to this renderer. This doesn't need to be unique to all entry points, but only to the backing renderer itself, and it needs to accurately describe the renderer - a native renderer should *not* return `meta.type === "dom"`, for instance.
	- This *should not* change except by user choice.
- `meta.version` - A number denoting this renderer's ABI version. This should remain stable across releases and exists for detecting whether to return a different value. It *should not* be incremented when no breaking change or vnode type addition has been made, but it *must* be incremented when a deliberate breaking change is introduced to behavior in the prior stable release. This enables components to simultaneously support multiple Mithril versions transparently.
	- Note: as a matter of policy, Mithril follows this strictly. Breaking changes between betas or release candidates do *not* result in an increment. Vnode type additions *do* result in a version increment. Things unrelated to rendering do *not* result in a version increment.

Renderers may choose to add other properties to this as they wish, but these must all three be present and never be changed by the renderer itself while the subtrees referencing it are mounted. (If user code *really* wants to screw with it, that's not a renderer concern, and it's obviously asking for trouble.)

One case where this can prove useful is with integration with third party DOM libraries, when you need to *not* invoke their methods in server-side code. The data here is considered static and is almost always going to be global to that module.

Core renderers do set the above required properties appropriately.

If you want easy sugar to require a particular version, use `requireVersion(meta, min, max)` from `mithril/hyperscript`. It checks `min <= meta.version && meta.version <= max` for you, throwing an appropriate error.

## What happened to lifecycle methods?

Those have been split into two parts:

- `oncreate`/`onupdate` - [`afterCommit: callback`](events.md)
- `onremove` - Stream unsubscription, `attrs` completion, [`onremove(func)` event listener](events.md).
- `oninit` - Function initializers for native vnodes that have them, component intitialization.
- `onbeforeupdate` - `attrs` stream emit + if nothing changed, just don't send an update. If you'd like some sugar for the equivalent for the boolean-returning `onbeforeupdate`, there's a `distinct(stream, by?)` method in [the core stream utilities](stream-utils.md) that you can use for equivalent effect.
- `onbeforeremove` - In the attributes, set an option to start the transition, then remove the vnode after it completes. [I do plan to expose a built-in utility for assisting with this](../mvp-utils/transition.md) as part of the MVP, and the hard part of doing this for lists is [another component I want to include](../future-utils.md#list-transition-api), just not required for the MVP itself.

It's worth noting we're currently the exception, not the norm, in baking async removal into core. Angular, React, Vue, and even Polymer require that async removal occurs with the explicit awareness of the parent. And it's not like we don't ourselves have catches in this: async removal only awaits the top-level vnode being removed. Anything else, even in Mithril, requires cooperation between parent and child.

The solution to async removal without framework support is through an intent system:

1. Set a flag on a component when you're about to remove it. That component should then do whatever it needs to do first, like toggle a class.
1. Once the component has done the necessary processing (like after the animation runs), it should invoke a callback to signal it's ready to be removed.
1. Finally, remove the node itself.
