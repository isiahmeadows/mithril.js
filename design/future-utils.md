[*Up*](./README.md)

# Non-MVP Utilities

These are all various utilities I'm considering including in the redesign library later, but none of them are guaranteed and none of them will be included in the core bundle unless otherwise noted.

## Create custom element from component

Basically, handles everything you need for hooking a component up and tying it to a custom element. Handles revival, attributes, children, and events equally, but you have to specify which events could be listened for.

## Querying components' rendered trees

This is exposed under `mithril/query` and provides the ability to render a tree, update it with attributes, and query children with selectors.

This would mostly amount to bringing `mithril-query` into core, but just the core logic of it, not the integration with Should or Chai.

## Advanced stream operators

This is exposed under `mithril/stream-extras`, and contains several various more advanced stream operators. Some of these also have runtime dependencies, and `mithril/stream` intentionally contains *zero* by design.

- `newStream = StreamExtras.debounce(stream, ms)` - Emit the latest value only if it's been at least `ms` milliseconds since the last value has been received from `stream`.
- `newStream = StreamExtras.throttle(stream, ms)` - Emit the latest value only if it's been at least `ms` milliseconds since the last value has been sent from the returned stream.
- `newStream = StreamExtras.cycle(ms, [...values])` - Cycle through `values`, emitting a value every `ms` milliseconds.
- `newStream = StreamExtras.zip([...streams])` - Zip an array of streams into a stream of arrays, buffering values as necessary.
	- Note: this does *not* drop values.
- `newStream = StreamExtras.from(object)` - Create a stream that wraps an iterable or an object with a `.subscribe` method.
- `newStream = StreamExtras.range(start = 0, end, step = 1)` - Create a stream that emits a range of values.
- `newStream = StreamExtras.toStream(value)` - Converts `value` to a stream if it's either an observable, a promise, an observable-like object (including Mithril streams with the redesign), a thenable, or just about anything else that could be considered async emitting from a single channel.
	- Note that only some things can be ended - notably promises and thenables can't.

This can eventually include others, too, and is meant to be the catch-all kitchen sink of stream operators as long as they're reasonably useful and not too niche. It's not the main module because you generally don't need these (for example, `on` - event handlers are usually good enough, and attributes), but it's there in case you need at least some of them.

## List transition API

This is exposed under `mithril/transition-list` and depends on `mithril/list-diff` (for `TransitionKeyed` only) and `mithril/transition` (for both).

- `m(TransitionKeyed, {in, out, event}, children)` - Define a keyed list of transitioned elements
	- `in:` - Zero or more space-separated classes to toggle while transitioning inward.
	- `out:` - Zero or more space-separated classes to toggle while transitioning outward.
	- `event:` - The event name to listen for. By default, this watches for `"transitionend"`.
	- `children:` - An array of zero or more keyed elements.

- `m(TransitionFragment, {in, out, event}, children)` - Define an unkeyed list of transitioned elements
	- `in:` - Zero or more space-separated classes to toggle while transitioning inward.
	- `out:` - Zero or more space-separated classes to toggle while transitioning outward.
	- `event:` - The event name to listen for. By default, this watches for `"transitionend"`.
	- `children:` - A function taking a value and index and returning a keyed element.

Notes:

- The values in `children:` are fed to `m(Transition)` as appropriate.
- Children are removed and re-added as applicable per the rules stated in `m(Transition)`.
- Keys are removed from transitioned elements in `TransitionKeyed` and `TransitionFragment` children when they're actually rendered.
- While an element is being animated out, if it's re-added without being removed, the `out` classes are simply removed, letting the animation reverse naturaly.
- While an element is being animated out, if it's re-added and removed again during that process, those cancel each other out and the `out` classes are re-added.

### Why?

1. Animated lists aren't easy to get right. I'll leave it as an exercise for the reader to try this first. 😉

## Selector binding

This is exposed under `mithril/select` and depends on `mithril/render`.

- `close = select(root, selectors)` - Bind selectors from an element to a vnode tree and return an unsubscription function.
	- `root` - The root element to watch selectors on
	- `selectors` - A key/value map where keys are selector strings and values vnodes plugged straight into `render(elem, vnode)` as the second parameter.
	- `close()` - Stop observing changes and clear the selectors.
	- Note: this doesn't recursively observe through selected roots. This helps keep things sane.

This uses `MutationObserver` with an appropriate mutation events fallback for IE (and falling back gracefully to doing nothing) to ensure that selectors do get rendered to when new elements are added matching them and have their trees removed when selectors no longer match an element.

*TODO: Look at how mutation observer polyfills work to figure out how to fall back correctly to mutation events.*

### Why?

This exists to ease integration into pages that are a heterogenous mix of Mithril and traditional static HTML and/or legacy content. The `MutationObserver` part is to be smart about it so you don't have to even manually render when elements matching the desired selectors are added - even if that selector doesn't get there until well after the page loads, the call still works.

It's also very declarative, and very CSS-like in how it binds views to selectors. It more or less "just works".

```js
select(root, {
	".mithril-date-picker": m(DatePicker),
	".widget .input": {placeholder: "Type away..."},
	"#app-one": m(One),
	"#app-two": m(Two),
	"#app-three": m(Three),
	// etc.
})
```

## Security verification using trusted strings

For things like `href: "javascript:..."`, those should require an opt-in. I'm blocked on work on trusted types, but I'd like an API that can integrate with whatever ends up used, whether it be [trusted types](https://github.com/WICG/trusted-types), [literals](https://github.com/mikewest/tc39-proposal-literals), or something else.

## Page transitions

Page transitions are one of those things that's never obvious to do. I'd like to explore to see what an adequate API would look like for helping people implement these.

## Event handler helpers

The DOM exposes a very low-level way of handling things, and it's not only easy to screw up at times, [it's also often hard to do *correctly*, even for the seemingly simplest of cases like a click](mvp-utils/router.md#links). So it may be worth providing some basic wrapper components for things like left clicks, drag-and-drop, long presses, among other things, stuff that's simple to the user, annoyingly complex for the developer.

[The React team is looking to do this themselves as well](https://gitter.im/mithriljs/mithril.js?at=5d363870d1cceb1a8da44199), and this is what prompted me to look into this in the first place, but in Mithril style, I'd like to keep it 1. simple, 2. easy, and 3. not in the core bundle. Thankfully, this redesign provides enough core primitives it's possible to [exploit this already for other things](mvp-utils/router.md#links), so it's entirely possible someone could come up with userland helpers first, and *then* them making their way into Mithril proper.

This was also in large part inspired by the React core team's work on sugared events for React, but with the mental model shifted to be a little more direct. Here's a few links for context:

- https://gitter.im/mithriljs/mithril.js?at=5d363870d1cceb1a8da44199
- https://twitter.com/isiahmeadows1/status/1158771013137707009
- https://gitter.im/mithriljs/mithril.js?at=5d49affb475c0a0feb0e4963

## An ESLint plugin with preset

I'd like to fork `eslint-plugin-react` as `@mithriljs/eslint-plugin-mithril`, and provide most of the same rules. Of course, we can't use it directly, and much of it applies neither to Mithril v2 *or* this redesign, so we'll have to alter a *lot* of them. For instance:

- [This rule](https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-array-index-key.md) would instead be checking if they're using the second argument to the `key` function.
- [This rule](https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/sort-comp.md) doesn't make much sense in a design that almost entirely *lacks* lifecycle methods to begin with. There's literally one: when the node is written to DOM. However, you *could* enforce a sort order with individual attributes and attributes relative to other nodes.

Also, rules based on [this accessibility plugin](https://github.com/evcohen/eslint-plugin-jsx-a11y) should be included in this plugin, with equivalents to their recommended rules + options included in our plugin's `recommended` list.

## A simple app/library generator

Many of us regular users have a set workflow and are just used to adding a bunch of crap to the `package.json` file and working accordingly. But setting up all that boilerplate gets tiring, and besides, we can provide a better workflow to get up to speed than writing to a bunch of files. We could instead provide a `@mithriljs/create-app` and `@mithriljs/create-lib` to generate those, and people would use `npm init @mithriljs/app`, `yarn create @mithriljs/app`, and similar to create it.

It of course would walk people through the process, and set them up with safe defaults and a sane setup. It doesn't have to be too complicated, but we do want something that *empowers* users - it gets old having to rebuild apps all the time, and there are a lot of ways to get yourself stuck in a rut. Here's a few of them:

- Getting DOM mocks set up correctly is deceptively easy to screw up, even for us experienced people.
- Not configuring your linter properly is an easy way to run into a slew of gotchas - ESLint doesn't check JSX names for existence by default!
- Forgetting to re-run tests on your app while you're trying to fix something, only to realize you broke something else in the process, with no idea what.
- Forgetting to install a testing dependency after you got everything else set up.

This is what the generator is for.

As for what it would *do*: it would walk the user through a simple process with a couple choices for user preference:

- Testing: Mocha + Chai, ospec, Jest
	- Mocha + Chai will be the default for familiarity.
	- Each would be set up with Karma with sensible OS-specific defaults for easy cross-browser testing.
	- ospec will *seriously* need to become more pluggable here for this to work, particularly with assertions.
- Code style: Vanilla, JSX
	- Vanilla sets up Rollup with Babel + `@babel/plugin-env` and calls it a day.
	- JSX also sets up `@mithriljs/jsx-babel`.
	- The production builds of those also enable `mopt` to optimize the heck out of them.
	- Modern vanilla will be our default here, as that's what most of us regular users use.

Then, it'd set up a Git repo at the specified location and install the following packages:

- `mithril`
- `@mithriljs/eslint-plugin-mithril`
- `@mithriljs/scripts` or similar, housing all the logic for `@mithriljs/create-{app,library}`, the dev server, the build system, and the test framework

And in `package.json` it'd save the choice of testing framework and code style.

The end structure would end up being generally all around useful and although it'll be necessarily opinionated in project structure, it'll be so you don't have to think much about configuration just to get started.
