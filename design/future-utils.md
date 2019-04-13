[*Up*](./README.md)

# Non-MVP Utilities

These are all various utilities that are, unless otherwise listed, kept out of the core bundle, but they are not considered part of the proposal's MVP.

## Advanced cell operators

This is exposed under `mithril/cell-utils`, and contains several various more advanced cell operators. Some of these also have runtime dependencies, so that adds to the boilerplate (and is why they aren't in `mithril/cell`).

- `newCell = CellUtils.debounce(cell, ms)` - Emit the latest value only if it's been at least `ms` milliseconds since the last value has been received from `stream`.
- `newCell = CellUtils.throttle(cell, ms)` - Emit the latest value only if it's been at least `ms` milliseconds since the last value has been sent from the returned cell.
- `newCell = CellUtils.cycle(ms, [...values])` - Cycle through `values`, emitting a value every `ms` milliseconds.
- `newCell = CellUtils.on(target, event)` - Emit events on each notification by `target`. For browser event emitters, this uses `addEventListener` and `removeEventListener`. For Node event emitters, this uses `addListener` and `removeListener`.
- `newCell = CellUtils.toCell(value)` - Converts `value` to a cell if it's either an observable, a promise, an observable-like object (including Mithril streams with the redesign), a thenable, or just about anything else that could be considered async emitting from a single channel.
	- Note that only some things can be ended - notably promises and thenables can't.
- `[send, result] = Cell.subject((cell) => result)` - Convert a cell factory into a reactive subject.
	- This is useful for unnesting `send` callbacks for use in certain reactive loops. In particular, it's useful to do `[dispatch, values] = Cell.subject(attrs => Cell.scanMap(attrs, initialState, (state, next) => [nextState, value]))`
	- Be careful to call `done` in your `done` callback, or at the very least, return `done`!
	- Not sure this belongs in the MVP - it's a pretty advanced use case.

This can eventually include others, too, and is meant to be the catch-all kitchen sink of cell operators as long as they're reasonably useful and not too niche. It's not the main module because you generally don't need these (for example, `on` - event handlers are usually good enough, and attributes), but it's there in case you need at least some of them.

## List diff

This is exposed under `mithril/list-diff`, and is useful when you need to apply Mithril's diffing algorithm before actually rendering the list. This is out of core because the internal diff/patch algorithm is actually stateful and operates on the IR directly, while this is necessarily a separate, second implementation emulating it for simple immutable lists of objects.

- `diff = new ListDiff.Keyed(initialValues, getKey?)` - Create a keyed diff tracker
- `diff = new ListDiff.Unkeyed(initialValues, getType?)` - Create a typed diff tracker
- Diff trackers:
	- `diff.all` - Get the list of all values.
	- `diff.isRemoved(index)` - Get whether the value at `diff.all[index]` is being removed.
	- `diff.update(nextValues)` - Update for next list of values
	- `diff.flush()` - Flush last update
	- `diff.scheduled` - Get the number of yet-to-be-flushed updates

Notes:

- Keys are treated as object properties, just like keys in Mithril's internal keyed diff algorithm.
- Types are compared by referential identity, just like keys in Mithril's internal unkeyed diff algorithm.
- Internally, I'd do a form of generational mark-and-sweep:
	- When adding a key, it starts at the global diff counter.
	- I'd increment all retained values' counters on update.
	- On flush, I'd remove all counters at 0 and then decrement the global diff counter and all remaining value counters.

This is *not* part of the MVP, but exists as part of the necessary standard library. It's a separate unit because it's hard to get right, but several relatively low-level async things like lists of transitioned elements and lists of elements linked to remote resources need it to perform proper caching aligning with Mithril's internal behavior.

## List transition API

This is exposed under `mithril/transition-list` and depends on `mithril/list-diff` (for `TransitionKeyed` only) and `mithril/transition` (for both).

- `m(TransitionKeyed, {in, out}, children)` - Define a keyed list of transitioned elements
	- `in:` - Zero or more space-separated classes to toggle while transitioning inward.
	- `out:` - Zero or more space-separated classes to toggle while transitioning outward.
	- `children:` - An array of zero or more keyed elements.

- `m(TransitionFragment, {in, out}, children)` - Define an unkeyed list of transitioned elements
	- `in:` - Zero or more space-separated classes to toggle while transitioning inward.
	- `out:` - Zero or more space-separated classes to toggle while transitioning outward.
	- `children:` - A function taking a value and index and returning a keyed element.

Notes:

- The values in `children:` are fed to `m(Transition)` as appropriate.
- Children are removed and re-added as applicable per the rules stated in `m(Transition)`.
- Keys are removed from transitioned elements in `TransitionKeyed` and `TransitionFragment` children when they're actually rendered.
- While an element is being animated out, if it's re-added without being removed, the `out` classes are simply removed, letting the animation reverse naturaly.
- While an element is being animated out, if it's re-added and removed again during that process, those cancel each other out and the `out` classes are re-added.

### Why?

1. Animated lists aren't easy to get right. I'll leave it as an exercise for the reader to try this first. 😉

## Babel plugin

Babel's existing `@babel/plugin-transform-react-jsx` would *technically* work for JSX + Mithril, but we could take this one step further with a Mithril preset + plugin combo: we could leave files entirely independent of `m`, so JSX would compile down directly to a bunch of object literals. This would also 1. adapt `m()` calls, so those can be compiled out, and 2. correctly handle JSX fragments, which can just compile to an array.

```js
// Original hyperscript
return [
	m("p.head_links", [
		m("a", {href: demoSource("mithril-redesign")}, "Source"), " | ",
		m("a[href='http://threaditjs.com']", "ThreaditJS Home"),
	]),
	m("h2", [
		m(Router.Link, m("a[href=/]", "ThreaditJS: Mithril")),
	]),
]

// Original JSX
return <>
	<p class="head_links">
		<a href={demoSource("mithril-redesign")}>Source</a> | {}
		<a href="http://threaditjs.com">ThreaditJS Home</a>
	]),
	<h2>
		<Router.Link><a href="/">ThreaditJS: Mithril</a></Router.Link>
	</h2>
</>

// Optimized
return [
	{tag: "p", attrs: {class: "head_links", children: [
		{tag: "a", attrs: {
			href: demoSource("mithril-redesign"),
			children: ["Source"],
		}},
		" | ",
		{tag: "a", attrs: {
			href: "http://threaditjs.com",
			children: ["ThreaditJS Home"],
		}},
	]}}
	{tag: "h2", attrs: {children: [
		Mithril.create(Router.Link, {children: [
			{tag: "a", attrs: {
				href: "/",
				children: ["ThreaditJS: Mithril"],
			}},
		]})
	]}}
]
```

In addition, I could actually *use* JSX's namespace syntax to my advantage to specify certain native Mithril vnode types, since you can't use `<#foo></#foo>` in JSX:

- `<m:fragment>...</m:fragment>` - This could represent unkeyed fragments.
- `<m:keyed>...</m:keyed>` - This could represent keyed fragments.
- `<m:html>...</m:html>` - This could represent trusted vnodes.
- `<m:catch onerror={...}>...</m:catch>` - This could represent catch vnodes.

This might cause TS problems, though, so I'd need to verify if they actually support it, and if not, get them to support it. (Short-term, I can just have people import the relevant component string names from `mithril/m`.)
