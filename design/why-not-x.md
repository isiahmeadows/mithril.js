[*Up*](./README.md)

# Why not X?

It's a fairly common question why I chose (or didn't choose) a specific model for components, one that's come up several times during my redesign work.

I was specifically looking for an abstraction that could tick several different boxes simultaneously. If any of these were not met, it was an immediate deal breaker, and I would not add support for it in core.

1. It has to be [simple](https://www.infoq.com/presentations/Simple-Made-Easy).
2. It has to be easy.
3. It has to have as few dependencies as possible, both implicit and explicit.
4. It has to be concise.
5. It has to be readable.
6. It has to be fast with minimal overhead, both in size and memory.
7. It has to support error handling.
8. It has to be highly composable.
9. It has to be highly decoupled.
10. It has to be highly encapsulated.
11. It has to be highly optimizable.
12. Code using it [has to be easily modified](https://joreteg.com/blog/architecting-uis-for-change).
13. It has to be explicit.
14. It has to be approachable.
15. It has to be reactive.
16. It has to be push-based.
17. It has to support maintainable concurrency with minimal effort.
18. It has to support simple stateful computation.
19. It has to support simple stateless computation.
20. It has to integrate well with the outside world.
21. And finally, it should help [make impossible states impossible](https://www.youtube.com/watch?v=IcgmSRJHu_8) and impossible operations unrepresentable where practical.

And on top of these, anything that lets me reduce the existing level of Mithril magic, including removing autoredraw, is only a plus.

And of course, this basically left me with almost nothing that currently existed. So I had to create a new abstraction for it, and eventually narrowed it down to a concept I've called streams, but they're a lower-level, simplified variation of traditional streams. This provides each of these, and [the various `mithril/stream` stuff](core/stream-utils.md) helps make it much more approachable.

Here's many of the ways I've looked at, and why I chose to avoid them.

## Table of contents

- [Traditional streams and observables](#traditional-streams-and-observables)
- [Async iterators](#async-iterators)
- [Pull streams](#pull-streams)
- [Callbags](#callbags)
- [Hooks](#hooks)
- [Classes (and equivalent abstractions)](#classes-and-equivalent-abstractions)
- [State reducers](#state-reducers)
- [Cells](#cells)
- [Generators](#generators)
- [Async Generators](#async-generators)
- [Others](#others)

## Traditional streams and observables

They generally require heavy dependencies to even operate, and even if I went to just accept anything that has a `Symbol.observable` method returning an object with a `.subscribe` method, it *still* would be a bit unwieldy to use.

They also have *some* overhead, and if you want to remove the performance and runtime memory overhead of it, you basically have to trade it for a lot of overhead in the form of bytes being sent over the wire:

- [RxJS 6](https://rxjs.dev): heavily optimized with 100+ operators: 44.5 kB min+gzip
- [Most core](https://github.com/mostjs/core): heavily optimized with a lot of "core" features but few operators: 14.9 kB min+gzip
- [xstream](https://staltz.github.io/xstream/): much smaller and slimmer with only ["hot"](https://medium.com/@benlesh/hot-vs-cold-observables-f8094ed53339) streams, designed for [Cycle.js](https://cycle.js.org/) (a virtual DOM framework driven by reactive streams rather than traditional components): 4.1 kB min+gzip
- [Mithril streams](https://mithril.js.org/archive/v1.1.6/stream.html): very small, but so barebones people are constantly reinventing critical functionality it lacks: 1.0 kB

## Async iterators

These are dependency-optional and have a variety of pros:

- They're *very* approachable. It's a native language feature.
- It's simple with clear native integration.
- The "done" hook is simple: it's when your iterable of attributes runs out.

But despite these, there are a variety of cons, some of which are pretty much deal breakers:

- It's pull-based, meaning it's active, not reactive. Yes, I could skip rendering if the value isn't being polled, but as part of the previous section, I made a big point: always be able to receive updates.
    - If attributes are pull-based, you *clearly* aren't always ready to receive updates, and that alone is enough to easily stop the data flow and end up with some pretty obscure state bugs in components.
    - If rendered trees are pull-based, there's now a *lot* of overhead every time you want to render something.
- Because it's promise-based and highly sequential, it's not very conducive towards reactive code. It's also easy to asynchronously block view updates by accident, which although that's not always a concern, it can be.
- That "dependency-optional" excludes a need to transpile if you plan to support IE at all. So in practice for many apps, there goes your ability to just use untranspiled JS. It's worth noting that Mithril does have a significant user share in government apps from what I've heard (both in-person and on various places on the Internet), in part *because* it's small, compatible, and avoids the need to transpile.

## Pull streams

[Relevant repo documenting the design pattern](https://github.com/pull-stream/pull-stream)

These are dependency-optional, but there are a variety of cons:

- It's pull-based, having the same set of related cons as async iterators. But not only that, polling requires a full function allocation returning a function to receive the value. That's a *lot* of overhead every time you want to render something.
- It's pull-based, but also callback-based, so reading is fairly boilerplatey and error-prone.
- There's a separate "through" stream that although it's a mix between readable and writable, it doesn't come out naturally through the design, so it's more complicated than a simple function from a reader to a reader or a writer to a writer. This is also harder to compose normally.
- Even though it's theoretically dependency-optional, in practice, you *do* need a significant standard library of operators for even the most basic of functionality. A few operators [even have to take into account recursion](https://github.com/pull-stream/pull-stream/blob/master/sinks/drain.js).

And finally, a no-op "through" stream is this monstrosity:

```js
// taken straight from their repo, with only formatting and nominal changes.
function through(op, onEnd) {
    var a = false

    function once(abort) {
        if(a || !onEnd) return
        a = true
        onEnd(abort === true ? null : abort)
    }

    return function (read) {
        return function (end, cb) {
            if(end) once(end)
            return read(end, function (end, data) {
                if(!end) op && op(data)
                else once(end)
                cb(end, data)
            })
        }
    }
}
```

Compare this to streams:

```js
// It's literally just the identity function
function through(stream) {
    return stream
}
```

## Callbags

[Relevant repo documenting the design pattern](https://github.com/callbag/callbag)

Unlike the previous one, this *does* have quite a few benefits:

- It's relatively simple on the surface.
- It's push-based.
- It's cooperative.
- It's highly explicit.
- It's highly decoupled.
- It's highly encapsulated.
- It supports multiple types of emits, so I could use extra IDs to *replace* context.
- It's fast and low-overhead most of the time. [Performance-wise, it's about 50% faster than RxJS, which itself is very highly optimized.](https://github.com/staltz/callbag-basics/tree/master/perf) (It's still slower than Most.js.)
- Transforming callbags naturally fall from the model.

However, it still has various cons, substantial enough for me to look elsewhere:

- Explaining how it translates to pipelines *isn't* simple, and the spec doesn't help this at all. It took me a few days personally to figure out how it all worked and integrated, because the spec and associated documentation/blog posts around it were *very* transparent about the data, but incredibly opaque on how it all fit together. (There goes the point on simplicity - the complexity isn't in the data but the interactions.)
- Transforming callbags isn't as simple as callbag in, callbag out. It's more like sink in, source out, which doesn't map as cleanly to the functional paradigm. For similar reasons, it's harder to compose.
- It's not very approachable to someone unfamiliar with function-based abstractions or basic data structures. You have to know how 1. protocols work, 2. event emitters work, and 3. state machines work, each somewhat in the abstract.
- Multiple references to the same callbag isn't always safe.
- Stateful computation is easy, but stateless computation still requires [a](https://github.com/staltz/callbag-map) [fair](https://github.com/staltz/callbag-merge) [bit](https://github.com/staltz/callbag-flatten/blob/master/index.js) [of](https://github.com/staltz/callbag-filter) [boilerplate](https://github.com/staltz/callbag-from-iter/blob/master/index.js).

## Hooks

Hooks are like the hot new thing right now, since [React added them](https://reactjs.org/docs/hooks-reference.html). They're based roughly on [algebraic effects and cell-oriented reactive programming](https://reactjs.org/docs/hooks-faq.html#what-is-the-prior-art-for-hooks), and function as a DSL. They do carry several pros:

- They do have reasonably low overhead, especially in memory and performance. Memory-wise, they're slightly less costly than streams, but they're more static than streams and have far fewer polymorphic calls, saving some CPU cycles.
- They are *very* approachable, especially if explained as an embedded DSL (which is what it really is) rather than some JS library. They're also fairly readable and somewhat easy to follow.
- Hooks *are* relatively concise, and pure computations are as simple as not using hooks.
- Hooks naturally encapsulate their data in a decoupled fashion similarly to how closures do.
- Hook composition is as simple as a procedural function call. No, really - it's just `const result = useHook(...args)`. Similarly, decomposition is equally simple.
- Hooks are easily modified to include new state and alter existing state.
- Hook inputs are just parameters - there's nothing special about them.
- Hooks are innately reactive - it's part of their design.
- Hooks support cleanup via effect done callbacks, something highly decoupled and easily abstracted.
- Hooks support conceptual "subscription" by simply specifying dependencies for `useEffect`, `useMemo`, and friends.

But there are some clear cons, too, many of which are deal-breaking:

- This absolutely requires a library to function. Otherwise, redraws aren't going to happen.
- This is neither push-based nor pull-based, but value-based. It requires a driving library to make it happen, and even something as simple as porting it to a stream [is far from simple under the hood, even if you simplify the hook operators to a core subset](excluded/hooks.mjs). (Or to put it another way, it's far from simple and it's reactive only for changing attributes.)
- For similar reasons, "subscription" doesn't exist in the general sense. The only way you get "subscription" is by using a return value.
- When one hook updates its state, *all* hooks are updated. This is a problem: hooks aren't correctly decoupled like they should be.
- As a DSL, there's a *lot* of implicit behavior going on, and I'm not just talking about the global nature of the hooks themselves. I'm talking about other things, too, like dependency diffing with `useEffect` and `useMemo`.
- Uninitialized states frequently show up in the context of hook state + DOM integration. This, of course, is a problem.

There is a [component DSL](stdlib/component.md) in large part inspired by hooks and Svelte, but it has several subtle but fundamental differences beyond names that make it work noticeably different in practice from either, and I would rather *not* conflate this with that. It's also designed *as a language* and not *as a library*, so it's much more fluid. Here's how it differs from React's Hooks API:

- You don't specify dependencies, but guard conditions.
- State can be immediate or lazy, but the functionality of the two are distinct and separate, not merged.
- You don't declare effects, but schedule blocks.
- Initialization is explicit and synchronous - you do everything immediately and inline.
    - If you want to cache something, use `memo` + `guard(hasChanged(...), ...)` where appropriate.
    - If you want to do something post-render, invoke `whenReady(ref => ...)`.
- It's more centered around "do" rather than just the "what", and there's a far cleaner separation between the "what" and "do" in the DSL.
- Render context (environment, whether it's the first run, etc.) is exposed in an easily accessible manner, and you can use that to conditionally apply various attributes and such.

> Or to put it another way: 99% of what you can do with React's DSL you can do with the component DSL proposal here fairly directly, but there's several classes of things you can do with the component DSL that you can't do with React Hooks. However, the way you do these things often differ substantially, so it's not advised to code in the same way you might code React Hooks.

But even with this DSL, that's a *library* because the implementation isn't something you can just slap together and call it a day with. It might seem simple to write, but unless you want slow, memory-hungry components creating a ton of extra garbage on every execution (a *very* terrible experience on mobile) and potentially even leaking memory, you *have* to optimize their memory heavily, and this is what turned a [simple 200-ish line implementation](stdlib/component.md#implementation) (minus `isEqual`) into a near 700-line behemoth. (This does not account for types, comments, compile-time constants, or development build checks in the actual implementation, BTW. Those jack it up well over 1000 lines.)

## Classes (and equivalent abstractions)

Classes seem like the perfect abstraction on the surface for encapsulating views. It's only natural that a component is just a class with a `view`/`render` method. Composition is easy: just add an object property. They're highly structured and decoupled from other classes in general. They integrate well with the outside world in a variety of ways. Most developers understand the concept of classes, and they're pretty easy to learn the basics of, even if you're a designer who otherwise struggles to grok code in the first place.

But that's approximately where that love letter ends. Because classes suck. Especially for view code because they don't work well with high asynchrony. If they didn't, this whole effort would be a revision, not a redesign.

And in this section, I'm not just talking about classes - I'm talking about every other way you can model that same abstraction, too. No matter how much you simplify it, you might be able to fix some of the common papercuts, but it won't address the underlying problem.

```js
// A class component with inherited explicit redraw
class Counter extends Component {
    constructor(initAttrs) { this.count = 1 }
    view(next, prev) {
        return [
            m("button", {on: {click: () => { this.count--; this.update() }}}, "-"),
            m("div.count", this.count),
            m("button", {on: {click: () => { this.count++; this.update() }}}, "+"),
        ]
    }
}

// A class component with implicit global redraw
class Counter {
    constructor(initAttrs) { this.count = 1 }
    view(next, prev) {
        return [
            m("button", {on: {click: () => this.count--}}, "-"),
            m("div.count", this.count),
            m("button", {on: {click: () => this.count++}}, "+"),
        ]
    }
}

// A closure component returning an object, with implicit global redraw
function Counter(initAttrs) {
    let count = 1
    return {
        view(next, prev) {
            return [
                m("button", {on: {click: () => count--}}, "-"),
                m("div.count", count),
                m("button", {on: {click: () => count++}}, "+"),
            ]
        },
    }
}

// An object component with implicit global redraw
let Counter = {
    oninit(initAttrs) { this.count = 1 },
    view(next, prev) {
        return [
            m("button", {on: {click: () => this.count--}}, "-"),
            m("div.count", this.count),
            m("button", {on: {click: () => this.count++}}, "+"),
        ]
    },
}

// A closure component returning a view function, with implicit global redraw
function Counter(initAttrs) {
    let count = 1
    return (next, prev) => [
        m("button", {on: {click: () => count--}}, "-"),
        m("div.count", count),
        m("button", {on: {click: () => count++}}, "+"),
    ]
}
```

And classes *aren't* the most obvious abstraction: there's still room for debate on what all methods are necessary to sustain them.

- You introduce autoredraw rather than relying on a superclass/etc. with a `redraw` method, and you remove the need for 99% of the boilerplate with state updates. This makes class-like abstractions more attractive, but it's practically a necessity for concise code.
- You bring a `m(Retain)` to retain the previous subtree, you've now fixed another major source of boilerplate, that of `shouldComponentUpdate`, `onbeforeupdate`, and equivalent, since diffing is a simple as just returning that instead of your view.

As for that simplicity of classes, sorry to break it to you, but they're not simple.

- Have you ever heard of `this` problems? The closure component examples above are mostly immune to that, but none of the others are.
- Raise your hand if you've ever run into an issue where a property isn't what you expected, and it's all because you forgot to set it elsewhere thanks to a state bug. 🙋‍♀️ If I walk in front of a room full of programmers using nearly any language with mutable objects by default, I would expect every single person paying attention to the question to raise their hand. And the only hands I'd see down would be from people who've only coded using purely functional idioms, designers who don't really code anything, and junior developers who probably lied about their experience on their resumé.
- Everyone talks about the simplicity of data, but the complexity in classes are not about the data itself, but relations within the data (inheritance isn't simple - sorry) and interactions between data.
- And as pointed out previously from linking [Rich Hickey's talk](https://www.infoq.com/presentations/Simple-Made-Easy), simple ≠ easy. Classes are easy, but it's so easy to do complicated things it's hard to *keep* them simple.

And no, classes *don't* compose that well, nor are they easily modified to begin with, not if you dream of reacting to any changes. They also lack the easy decoupling ability that you need for maintainable views.

- You practically *have* to have a callback just to receive data. Or if you specifically want to stick with objects, that's only more complicated.
- You need to add a new attribute parameter? Chances are, you'll need to insert code in half a dozen different places just to add it.
- If you really *do* want easily modified classes, you almost always have to go with an unusual architecture that's not really object-oriented at all, but really more just "struct-oriented".
- Class *data* composes well, but class *interactions* don't. This is really the core of the composition issues classes have.

And they fail most of the other points, too:

- If you admit global redraw (a necessity to avoid verbosity), you've just created an implicit global dependency. That's no longer dependency-optional.
- Classes aren't concise. This *can* be mostly fixed by using closures returning view functions, so this is only a failure of classes themselves.
- Classes are readable in terms of what data it *has* and getting a general idea of what it *could* do to data, but the logic side isn't nearly as readable or easy to follow. It also isn't the most approachable.
- Classes *can* be reactive, but they don't *force* you to be reactive and ready to receive updates. It also takes ceremony to receive updates from child classes.
- Classes *can* be highly encapsulated, but it's *very* common to break that encapsulation, often *too* easy.
- Dynamic method calls [aren't as fast as what you would think](https://benediktmeurer.de/2018/03/23/impact-of-polymorphism-on-component-based-frameworks-like-react/), so the obvious `inst.view(prev, next)` call the framework would call is actually a slow way. Note that this is *highly* specific to direct class-like abstractions and not the final example with a closure returning a direct view function (which dodges it altogether - the engine *does* handle this one correctly).
- Implicit autoredraw is still implicit. But even an explicit `this.update()` is often hidden away as an implicit action through various layers, so subtle state changes can cause problems. This variant is at least not hiding implicit state-setting calls that are naturally asynchronous, like React does with `setState`, so it's at least not outright *magical*.
- Classes are approachable, but only to a point. Simple classes are approachable. But it's so easy to introduce complexity in them that they quickly become less and less approachable to those unfamiliar with the architecture. You basically have to actively fight complexity in part just to keep them approachable not only to others, but to you 6 months down the road.
- Classes are mostly value-based. This itself makes it harder to react, but there's enough message passing and rendering is push-based *enough* that it's at least not *hard* to react to changes from things other than attributes.
- Stateful computation is easy, but it's not *simple*. It's *too* easy, so easy it's easy to make it too complicated to grok even for an experienced senior-level developer.
- Stateless computation sounds easy, but it's not, and it's not simple, either. It frequently requires accessing class-local data, and it's easy to accidentally introduce stateful computation in the middle of performing that seemingly stateless operation. And [spooky action at a distance](https://en.wikipedia.org/wiki/Action_at_a_distance_%28computer_programming%29) isn't exactly a fun thing to debug.
- Classes in my experience have provided *negative* help in making invalid states and operations unrepresentable - they seem to almost encourage it at times. You have to basically fight the abstraction for it, which is never fun and always a bit of a productivity killer.

Honestly, I could probably write a small book about what classes and object orientation are *actually* ideal for, versus what they make genuinely harder. But this section *should* hopefully summarize why I left classes (and similar abstractions) in the first place.

## State reducers

After trying the above, simplifying it, and still failing, I moved on to the concept of a state reducer, basically a `(attrs, state, context) => {next: nextState = state, value, done?}`, where you can return a vnode as sugar for `{next: state, value: vnode}`. State updates were done via `context.update(state)`, inspired very much so by React's `setState` but meant to be a little less magical than it. To retain the previous value, you'd return an `m(Retain)`. It ticked some of the boxes, but not all.

- It's fairly simple, but not maximally so.
- It's 100% dependency-optional, and most use didn't even really *need* explicit dependencies.
- It makes for decently concise code in most situations.
- The consistent data flow is reasonably easy to follow, so it's pretty accessible and readable.
- The single code path is very engine-friendly and fast.
- Composition is just using a state reducer in a state reducer, and each reducer is highly decoupled from others.
- It's very easy to localize all subtrees and removing autoredraw was still something I could do without complicating everything.
- Most changes are simple changes - it's easier to modify than even React hooks.
- If it's pure, it's literally as simple as `(attrs) => m("div.view")`
- It basically forces you to adhere to best practice by going out of its way to make it it hard to block the data flow within a component.

For one example, a counter component would be as simple as this:

```js
function Counter(attrs, count = 1, context) {
    return {
        next: count,
        value: [
            m("button", {on: {click: () => context.update(count - 1)}}, "-"),
            m("div.count", count),
            m("button", {on: {click: () => context.update(count + 1)}}, "+"),
        ]
    }
}
```

And pure components are simpler, almost maximally simple:

```js
function ThreadNode({node}) {
    return m("div.comment", [
        m("p", {innerHTML: node.text}),
        m("div.reply", m(Reply, {node})),
        m("div.children", keyed(node.children, "id",
            (child) => m(ThreadNode, {node: child})
        )),
    ])
}
```

But there are several cons, enough that it just wasn't cutting it.

- Anything reasonably black-box enough and complex enough got complicated in a hurry, and the resulting design pattern was neither obvious nor simple. It was no longer a reducer in practice, but a class in the shape of a reducer, usually of the form `(attrs, state, context) => { if (state == null) state = initSomehow(); updateState(state); return {next: state, value: calcView(state), done() { whatever() }} }`, but where those functions stand for a long series of statements. It'd be simpler for them if you just had a class that had each of those hooks, and by that point, you might as well just use traditional classes for components, losing all the benefits of a superficially simpler model. Also, expect a lot of `context.update(state)` calls in these scenarios, at the very least.
- It really didn't integrate very well with the outside world, especially with stateful things you may be using elsewhere. It's nice if you're using Redux or Meiosis, but if you're using a traditional model, it gets boilerplatey in a hurry, even with the simple stuff.
- It doesn't split apart very well, as every state reducer relies on its caller to just sustain the state correctly. This coupling through an implicit dependency made it far too complicated to compose, and composition would almost always require a dependency to even work reasonably. (It composes well with external classes and the such, though, just not with other state reducers.) It also meant I couldn't reuse it as a general state container.
- It's push-based in invoking updates, but it doesn't offer the most natural way to just not update the tree.
- If you need to detect the difference between external and internal updates, this is way more difficult than it should be. You basically have to tag updated states like `{type: "init", state: ...}` for initialization, `{type: "update", state: ...}` for external updates, and `{type: "patch", state: ...}` for internal updates. That does eventually get annoying, especially when most other variants *don't* require this.

## Cells

Another idea I tried to do was use a concept I called "cells". It's a further reduced form of streams that lacked the ability to close themselves, but this functionality is unnecessary in the context of UI views. It covered nearly all the checkboxes, and code often looked like this:

```js
function ThreadNode(attrs) {
    return (render) => attrs(({node}) => {
        render(m("div.comment", [
            m("p", {innerHTML: node.text}),
            m("div.reply", m(Reply, {node})),
            m("div.children", keyed(node.children, "id",
                (child) => m(ThreadNode, {node: child})
            ))
        ]))
    })
}

// Or with a cell utility library
function ThreadNode(attrs) {
    return Cell.map(attrs, ({node}) => m("div.comment", [
        m("p", {innerHTML: node.text}),
        m("div.reply", m(Reply, {node})),
        m("div.children", keyed(node.children, "id",
            (child) => m(ThreadNode, {node: child})
        ))
    ]))
}
```

This came very close to the ideal, and it compressed *very* well, but it came with a few major glitches.

1. There was no way to signal or propagate errors during computation. This turned what looked like simple code into a beast of messy hacks with a lot of boilerplate, so it really just turned out to be easy, not simple.
2. Because there was no way for a stream to notify descendants of its closure or completion, it was far too limited to just the view. This of course *is* a problem, just one I didn't recognize immediately when drafting this proposal.
3. It was easy to extend to new cell types, but that extensibility was as easy as mixins to use. Mixins are obviously not *simple* to extend (just easy), and that also obviously doesn't scale as well. So I decided to rip that out entirely and change control vnodes to a simpler abstraction that also turned out to fit a little better and more composably. (It turned out splitting the functionality into 2 new vnode types simplified it a *lot*.)
4. Parameters weren't normalized, so any serious logic requiring multiple `done`s ended up getting verbose and boilerplatey in a hurry. It just got flat out nasty at times.

So because of these growing pains, I found I couldn't stick with this abstraction.

## Generators

One idea I briefly entertained, and was later recommended for me to look into again, was using generators, yielding for attributes and yielding views.

```js
function *Counter() {
    let count = 0
    let attrs = yield
    while (true) {
        attrs = yield [
            m("button", {on: {click: () => count--}}, "-"),
            m("div.count", count),
            m("button", {on: {click: () => count++}}, "+"),
        ]
    }
}
```

It looks like it fits perfectly with JS here, and it does share most of the benefits of using streams and related, but there's two major issues:

1. That's a lot of boilerplate.
2. Generators have an "end", but components don't know when they're going to end, and it's unclear what should happen when a component "terminates", whether it should remove itself or if it should just freeze and become static, and whether "on remove" callbacks should be fired immediately after it "terminates", after the underlying node is removed (well after "termination" if it's static), or never. It's also unclear how to handle generator return values. (Components are plugins, not complete programs, contrary to popular belief.)

## Async Generators

Someone pointed out to me [a new (at the time of writing) framework](https://crank.js.org/blog/introducing-crank) based on async generators. Here's a simplified version of that:

```js
async function *Counter(updates) {
    let count = 0
    for await (const attrs of updates) {
        yield [
            m("button", {on: {click: () => count--}}, "-"),
            m("div.count", count),
            m("button", {on: {click: () => count++}}, "+"),
        ]
    }
}
```

It's a similar story to using standard generators with similar benefits, but it still carries its issues + an additional one unique to async generators:

1. That's a lot of boilerplate. It's not as bad as with standard generators.
2. Async generators also have an "end", with the same problematic edge cases.
3. Async generators are pull-based, incurring a lot of overhead. It's not possible to render everything in a single pass, and batching these for efficient processing will be nearly impossible. Global redraws would also be necessary to drive this unless you want the (in my honest opinion) counterintuitive event handling model that [Dear IMGUI](https://github.com/ocornut/imgui#usage) uses for handling clicks and such.

Before I was told about that framework, I also considered using normal generators but yielding with `{await: ...}`, `{view: ...}`, and similar, effectively a blend of this + the previous section, but it only came out *very* boilerplatey and just overall not worth the complexity. I'll leave it up to the reader to synthesize that into a code example - it's not pretty.

## Others

There's of course other things I've considered, too, even if just briefly, so I'm not going to go into too much detail:

- Reactive cells, RxJS subjects, and similar: All the benefits of reactivity, but with all the usual boilerplate and then some. It's not unlike just using a bunch of atomic variables unnecessarily, and it doesn't scale very well. Also, by this point, it'd be easier just to use streams or observables in many cases, but this is also something I've decided against as explained in detail previously.
- Reactive DSLs: This goes against the entire Mithril mantra of being "just JavaScript". No matter how compelling this might be (especially if defined via rules and relations), that's a *steep* slope to climb, and it isn't always practical for some users. There's also some lack of clarity in when it should be redrawing - if it's all immutable, this decision is easy, but that's not something you can always assume, even in many of those domain-specific languages (like [DisplayScript](http://displayscript.org/) and [Svelte](https://svelte.technology/)). And on top of all this, there's no way you can really do this both performantly and concisely *without* a DSL that *compiles* to JavaScript.
- Pipelines, wires, Node-style streams, and similar: Abstracting computation is nice, but it's not a great fit as a primitive for managing views. Components themselves *could* be treated as such, but pipelines don't easily *nest*, making them mostly unsuitable for views. This is also why components using React Redux are so often boilerplatey and why [Reflex](https://reflex-frp.org/) examples can [sometimes read a bit arcane at times](https://github.com/reflex-frp/reflex-examples/blob/master/frontend/src/Frontend/Examples/BasicToDo/Main.hs) in the way it unnests events, even if you already know how to read Haskell and understand how functional reactive programming works.
- Stateless templates as views and components as view controllers: The separation sounds like a nice idea in theory, but it's not actually that useful in practice, not without a [compile-time step](https://svelte.technology/) that obviously isn't going to happen with Mithril barring some drastic change in community sentiment.

This is by no means a complete list, but it should hopefully show some of the other things I went through before coming around to the abstraction of cells. Plus, this might be able to give you a little bit of insight as to why I arrived at *that* abstraction over various others, and if you do have ideas on how things might be improved, it can serve as a nice start point so [you can at least understand why it's the way it is *first*](https://en.wikipedia.org/wiki/Wikipedia:Chesterton%27s_fence).
