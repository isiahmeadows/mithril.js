# Mithril Redesign

## Status

This is a major work in progress, and is very much so a pre-proposal that's still being honed and improved upon. Please don't assume *anything* here is actually going to make it into the next version. Also, don't assume it's targeting version 3 either - I started out calling it a "v3 redesign" (hence the original branch name) because it's a major API overhaul, but there are no active plans for any of this to actively target version 3 specifically.

> I *could* change the branch name, but I don't feel like trying to replace every v3 reference out there *and* break existing links I've thrown out, so it's just easier to do this way.

## Feedback?

If you have *any* feedback, questions, or concerns, please do feel free to [file an issue](https://github.com/isiahmeadows/mithril.js/issues/new).

## Table of contents

- [Core changes](core/README.md)
- [Utilities added to `mithril/*`, part of the MVP](mvp-utils/README.md)
- [Utilities added to `mithril/*`, not part of the MVP](future-utils.md)
- [Rationale](rationale.md)
- [App comparison](examples/threaditjs/README.md)
- [Non-features](non-features.md)
- [Vnode and IR structural changes](vnode-structure.md)
- [Bitwise operations explainer](bitwise.md)
- [Examples](../examples/README.md)

## Summary

My general goal is this:

1. If it feels right, it should be right.
2. Simple should be easy with the complex still possible.
3. The natural way should also be the fast way.

### Feeling the code quality

> 1. If it feels right, it should be right.

The code you thought you wrote should be the code you meant to write. There should *not* be any subtle behavior that changes this. In the case of a virtual DOM framework, subtle behavior like this (snippet taken from [this blog post](https://overreacted.io/writing-resilient-components/#principle-2-always-be-ready-to-render)) should not exist.

```js
// React
class TextInput extends React.Component {
	state = {
		value: ""
	}
	componentWillReceiveProps(nextProps) {
		// This resets local state every time a parent receives properties *and*
		// it schedules a re-render.
		this.setState({ value: nextProps.value })
	}
	render() {
		return (
			<input
				value={this.state.value}
				onChange={(ev) => {
					this.setState({ value: ev.target.value })
				}}
			/>
		)
	}
}

// Mithril v2
function TextInput() {
	let value = ""
	return {
		onupdate(vnode, old) {
			// This resets local state every time a parent receives properties
			// *and* it schedules a re-render. It's done *after* the view is
			// rendered to ensure the value isn't prematurely changed.
			value = vnode.attrs.value
			m.redraw()
		},
		view: () => [
			m("input", {value, onchange: (ev) => value = ev.target.value}),
		],
	}
}

// Direct equivalent in this redesign - it *certainly* raises questions, and
// it's not only not idiomatic, but a little cumbersome to write and hard to
// follow because the control flow is all over the place.
function TextInput(attrs) {
	let value = ""
	return (o) => {
		function update() {
			o.next(m("input", {value, onchange(ev) {
				value = ev.target.value
				update()
			}}))
		}

		return Stream.map(attrs, (nextAttrs) => {
			value = nextAttrs.value || ""
			update()
		})
	}
}

// Simplified equivalent in this redesign - it *still* raises questions, and
// it's equally hard to follow correctly due to all the recursion.
function TextInput(attrs) {
	return (o) => {
		function update(value) {
			o.next(m("input", {value, onchange(ev) {
				update(ev.target.value)
			}}))
		}

		return Stream.map(attrs, ({value = ""}) => update(value))
	}
}
```

You can tell right away something about that redesign code just doesn't *feel* right. It feels awfully complicated for what it is, and it actually took a bit of thought for me to actually port it to replicate the issue detailed in that blog post.

In that article, it offers two ways to fix it, both of which are equally simple. In both cases, the redesign's explicitness makes it clear you *have* to handle dependencies and how they interact. It forces you to actually think about the logic, so you're less likely to run into subtle state bugs.

```js
// React
// Option 1: Fully controlled component.
function TextInput({value, onChange}) {
	return (
		<input
			value={value}
			onChange={(ev) => onChange(ev.target.value)}
		/>
	)
}

// Option 2: Fully uncontrolled component.
class TextInput extends React.Component {
	state = {
		value: ""
	}
	render() {
		return (
			<input
				value={this.state.value}
				onChange={(ev) => {
					this.setState({ value: ev.target.value })
				}}
			/>
		)
	}
}

// We can reset its internal state later by putting it in a fragment as the only
// element in it and changing the key:
return <><TextInput key={formId} /></>

// Mithril v2
// Option 1: Fully controlled component.
let TextInput = {
	view: ({attrs: {value, onchange}}) =>
		m("input", {value, onchange}),
}

// Option 2: Fully uncontrolled component.
function TextInput() {
	let value = ""
	return {
		view: () =>
			m("input", {value, onchange: (ev) => value = ev.target.value}),
	}
}

// We can reset its internal state later by putting it in a fragment as the only
// element in it and changing the key:
return [m(TextInput, {key: formId})]

// Direct equivalent in this redesign
// Option 1: Fully controlled component.
function TextInput(attrs, events) {
	return m("input", {
		value: Stream.map(attrs, "value"),
		onchange(ev) { return events.emit("change", ev.target.value) },
	})
}

// Option 2: Fully uncontrolled component.
function TextInput() {
	let [value, setValue] = Stream.store("")
	return m("input", {value, onchange(ev) { setValue(ev.target.value) }})
}

// We can reset its internal state later by creating a store to fire resets on
// command.
let [resetSignal, reset] = Stream.store()
return map(resetSignal, () => replace(m(TextInput)))
```

If you have to focus on avoiding a gotcha in Mithril rather than writing logic, Mithril is clearly getting in your way of actually doing things, and this is what the redesign is aiming to avoid.

### Keeping it easy to use

> 2. Simple should be easy with the complex still possible.

There's an entire presentation titled ["Simple Made Easy"](https://www.infoq.com/presentations/Simple-Made-Easy) by Rich Hickey, the creator of Clojure. He makes several valid points, including:

- We should aim for simplicity because it's a prerequisite for reliability.
- Simple and easy are *not* one and the same.
- Simple things include things like values, functions, namespaces, data, and declarative data manipulation.
- Simple things do *not* include things like state, objects, methods, inheritance, loops, and conditionals.
- Abstraction, encapsulation, and avoiding complexity are what lead to simple systems.

Conflating "simple" and "easy" is what led us to this mess of awful frameworks in the first place. Angular considered classes "simple", yet missed the forest for the trees when designing an entire API around that, eventually resulting in such [lasagna code](https://en.wikipedia.org/wiki/Spaghetti_code#Lasagna_code) they had no choice *but* to rewrite it. React saw classes as easy and it took until maybe a year ago to realize hey, functions are simpler than classes and stateful components are not unlike a function from attributes to a view, just closing over possible state. Vue saw two-way binding as "simple" and started conflating views with view models without realizing why the separation existed. (React deliberately and consciously merged views and controllers, but Vue only half-merged them.)

And finally, hiding complexity in the framework, like with implicit redraws, doesn't simplify the framework. It also doesn't simplify it for the user, because framework complexity isn't about internal complexity, but external complexity. Angular is *super* complex, and even many Angular fans admit it's not *simple*. React's complex, because it has a *lot* of subtle behaviors and entire pages documenting these subtleties. And if you look [at a diagram documenting how it all works](http://projects.wojtekmaj.pl/react-lifecycle-methods-diagram/), it looks simple on the surface. Click that checkbox of "Show less common lifecycles", and you see a lot more complexity just in the class side. Now that they've added hooks, you might as well double that complexity surface, because it comes with all its own edge cases. And of course, Vue has its own hidden complexities, like around change detection and two-way binding.

But the focus here is to simplify it for the user, to push it for them. And we shouldn't optimize for simplicity just in writing the code, but in modifying the code, too. Mithril shouldn't be a write-once framework, something [even React took into account](https://overreacted.io/optimized-for-change/). You more often read code than write it, and you more often tweak existing code than you do creating new code. *This* is what a framework should optimize for, and it's one of the things this redesign optimizes for.

No framework is an island unto itself, and most frameworks fail to take this into account, React included. Staying in the framework should be easy, but talking to the outside world should be equally easy, even if you want to go head-first into everything Mithril in your own component. This integration includes both integrating a jQuery component into a Mithril app and integrating a Mithril component into an Angular app. Even if it's not simple, it should still be possible and very practical.

A good framework doesn't just stop at making the simple easy, but it should also make the complex possible. Common complex things like async data loading, transitions, and rendering to string should be things users *don't* have to write. They also shouldn't have to search for them - it should already be there for them. Complex data flow within components should be something users can do without much thought. Event handling should have zero trouble scaling even in the most complicated of cases - 2 events should be just as easy to track as 20. But even if it's complex, it shouldn't be *hard*, especially hard to do *right*. To add to all this, it should come with the right state primitives to make simple, yet powerful state manipulation with reasonably low effort. (This doesn't mean that it all has to be included *in* the core bundle. They can still be separate modules, just shipped with the npm package *with* the core bundle.)

And finally, the framework's job, as [Rich Harris explained fairly well](https://youtu.be/qqt6YxAZoOc), is not to organize code, but to organize your mind. They shouldn't have to have a major impact in your code size, and if anything, it should *reduce* how much overhead exists between your code and the user. Although this does still remain "just JavaScript", it does so without introducing nearly as much runtime overhead or mental overhead in the process:

- Unlike literally every other tree reconciliation-based framework I've ever seen (and I've seen a lot more than I care to admit - have you heard of [Turbine](https://github.com/funkia/turbine), [Anvil](https://github.com/zserge/anvil), or [Miso](https://haskell-miso.org/)?), this makes trees static by default. This is useful for dramatically increasing performance and dramatically reducing retained memory. However, streams provide very simple, easy abstractions to use to make parts of them dynamic, and those themselves are fairly light. (This is among other numerous optimizations, of course.)
- This tries to streamline and simplify the mental model as much as possible, even sometimes at the cost of implementation complexity. There is this saying in UX and design circles that goes "Don't make me think!" (and a book with [exactly that title](https://en.wikipedia.org/wiki/Don't_Make_Me_Think)), and my goal with this redesign is to work with the developer's first instinct of what's correct and not make them sweat the little details of their components like data.
- One of the overarching goals of this redesign is to get out of your way and let you actually *do* what you want to do. Most frameworks are concerned about *what* the current state is and *what* data is being shown, including React, Angular, and even Svelte. They're concerned about state, not functionality. Users care about functionality, and I want Mithril's goal here to be to enable you to *do* what is needed. (And yes, if/once this redesign becomes Mithril I plan to replace our current tagline of "A JavaScript Framework for Building Brilliant Applications" with something about "doing".)

### Keeping it fast

> 3. The natural way should also be the fast way.

Performance should be the last thing you care about. There's not a ton to improve upon here, but it *is* something that does in fact matter. And there's more to performance than raw CPU cycles spent diffing trees - there's also GC churn and memory usage to take into account. But all this performance detail should just naturally fall out of your code. The common case, code that feels natural, should never be slow. [Engine developers have realized this](https://v8.dev/blog/web-tooling-benchmark), but frameworks tend to fall in one of two categories: either it's all slow (Angular), or you *can* be fast, but only if you do things that stick out like a sore thumb and often don't look idiomatic (React, Vue, Mithril v2).

Instead, effort should be taken to ensure the natural way is also fast. This includes designing the API for performance and making it easy to make things fast. For example:

- Invoking functions [goes through a lot less ceremony than invoking methods](https://benediktmeurer.de/2018/03/23/impact-of-polymorphism-on-component-based-frameworks-like-react/).
- Push-based rendering means updates can be hyper-localized with minimal effort, and it's sometimes easier.
- There are intentionally very few entry points into the API, and that is so the framework operates more like a black box.
- Having a single code path to receive attributes means local variables are much more often used to compare and initiate updates, something engines optimize better.

But above all, this ends up feeling natural and you end up doing the right thing without thinking about it. It *guides* you to write good code.
