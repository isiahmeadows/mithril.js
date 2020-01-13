[*Up*](./README.md)

# Rationale

There's a lot of big decisions here that require some explanation.

## ES3 syntactic compatibility

I don't plan to actively test against ES3 engines unless I'm alerted that there's a enough of a user base *still* using IE8 that I need to ignore Microsoft's dropping of support, but I will attempt to keep at least syntactic compatibility so users stuck on severely outdated systems can at least cope with this through sufficient polyfills. Pressure by the OS developer (99% of the time it's Microsoft) and lack of support by them should generally be sufficient.

This is per request by a few people developing for projects on relatively ancient operating systems. (There's still a few enterprises and government organizations working on migrating away from IE to modern web technologies. These are the places I feel sorry for those cursed with that kind of job, but I respect and understand their situation.)

## Removing arbitrary selector support in the hyperscript DSL

This was not a decision made lightly, but it's very much rooted in human psychology, actual usage, my own experience, various complaints I've read through the years, and many other things I've seen and read.

Note that class selectors are still supported. It's just the only thing that remains supported as it's such an incredibly common case and about the only case that merits its inclusion.

### Science behind the implicit `div` issues

The behavior of the implicit `div` has created more confusion than it's proven worth. [I go into some detail about this in the vnode docs](vnodes.md#tags), but here's a more extended explanation on the subject.

In short: Humans aren't made of silicon. They don't process things sequentially. When reading `m(".button.confirm")`, your first instinct isn't likely that it's short for `m("div.button.confirm")` unless you've been using primarily Mithril for years, and even then it's probably not *reliably* so. This is especially true in more complex scenarios like `cond ? m(".foo") : m(".bar")` where you might need to consciously recall the rule. And `m("")` could be reasonably interpreted as both `m("div")` and `[]` by two different people. So to fix a UX issue I've seen appear repeatedly in our Gitter and other places, I suggest we require a tag name.

And for the long story. Be ready for some very scientific language diving a into a bit of linguistics, natural language processing, and how humans interpret language - there's a fair bit of science I'm pulling from.

Computers parse information sequentially. Humans also parse sequentially for the most part, but we don't always parse written language in-order when inspecting individual characters and tokens - it's faster to parse them in parallel when we can. (In fact, visual dyslexia is when people parse things *too* out of order.) Usually, it speeds things up a lot, since our brains rely on the probabilities of various types of words and punctuators appearing in a certain order, but this isn't always the case: [garden path sentences](https://en.wikipedia.org/wiki/Garden-path_sentence) *do* cause errors in that your natural parallel lookahead ends up failing because of a single token detected. For instance, when you read "The old man the ship.", you initially start to read that as "(The<sub>article</sub> (old<sub>adjective</sub> (man<sub>noun</sub>)))", where parentheses delimit what you read. When you start to parse "the ship", an obvious noun that parses to "(the<sub>article</sub> (ship<sub>noun</sub>))", you realize there wasn't a verb parsed yet, so you have to reparse the entire part leading up to that, searching for a verb, then where that underscore is, you notice there's no verb. So instead if your anticipated parse tree, you have to reparse it entirely, expecting a verb at the end and potentially adjusting your parse tree further until you get one that works. The correct parse tree for that bit is "(The<sub>article</sub> (old<sub>noun</sub>)) man<sub>noun</sub>", and the correct parse tree for the whole sentence is "(The<sub>article</sub> (old<sub>noun</sub>)) man<sub>noun</sub> (the<sub>article</sub> (ship<sub>noun</sub>)).".

(In case you're wondering, [this very thing has been studied at a lower level than even this](https://en.wikipedia.org/wiki/Garden-path_sentence#Brain_processing_in_computation). I'm just adapting the language to make more sense from a computational perspective, and this isn't about the neuropsychology of it, just the computational aspect of it at a higher level.)

A similar issue is at play here: when you process the selector `.button.confirm`, you're used to the first real word generally denoting the type, ignoring the fact there's a punctuator before it. This plays on your brain's probabilities and eventually results in a misparse, since that's *usually* what it ends up being and it's practically always the case when the conceptual "type" isn't `div`. But when you're not as innately familiar with the rules in that edge case, you might not think to reparse and you might look at it as either an error because it looks weird (unlikely if you've seen it enough) or you might correct it to not include that `.` - it certainly doesn't work as a sigil like `@` does in various languages. (In fact, I've witnessed that very source of confusion among newer users countless times asking questions in Gitter - they expect `cond ? m(".foo") : m(".bar")` to work like `cond ? m("foo") : m("bar")` when in reality it works like `cond ? m("div.foo") : m("div.bar")` - the reason the latter doesn't work that way is a little easier to explain.) It obviously isn't the *same* as `m("button.confirm")`, but people's first reactions are to think `m(".button.confirm")` should work similarly when it *doesn't*. It really works as similarly as `m("button.confirm")` and `m("div.button.confirm")` do - they're still related, but they don't work almost the same way. If two things don't work the same way, there shouldn't be syntax sugar making them look like they do.

Separately, in the special case of `m("")`, following the rules of disambiguation, it would be equivalent to `m("div")`, but a related thing is going on here that causes people to intuitively expect it should evaluate to a fragment: there's no clear data, even inferrable from context, associated with the contents of the element, so it's only natural to think it should be equivalent to just its children or, alternatively, a fragment containing them. Natural languages themselves do not typically feature information implied from rules of grammar - it's normally encoded in the words and the surrounding context it was transmitted in, not from the parsing step itself. Cases like "Adam is cooking?", which implies through its non-standard usage an expectation of falsehood, are the exception, not the norm, and even that's not standard usage. Coming from that background, it makes sense that some people, being aware of the rules, will feel that `m("")` should intuitively represent a fragment rather than an element. And unlike the scenario of garden path sentences, which look like errors but don't look like fragments and don't need reparsed as one, this *looks* like it's a fragment missing critical information, and in fact, [we *did* decide to make `m("")` itself throw due to the confusion it was causing](https://gitter.im/mithriljs/mithril.js/archives/2015/12/12).

This should help explain from a scientific view *why* I initially looked to remove support for implicit `div` tag names from selectors altogether.

### Code complexity vs material benefit

There is little payoff for introducing [80 lines of code](https://github.com/MithrilJS/mithril.js/blob/34f4363357356435a865389dabd5fb11f529bb15/render/hyperscript.js#L7-L83) just to code something that takes only a few small characters. In smaller projects, this likely takes up more space than the characters saved by using selectors, and in larger projects, it still doesn't really save anything. It's less to type initially, but you spend a lot more time reading than writing code. And of course, consistency in source directly translates to better compressibility. For some examples:

```js
// All in selector
Mithril.mount(document.body).render(
    m("input[type=text][placeholder='Name']"),
    m("input.user-name[type=text][placeholder='Name']"),
    m("input#user-name[type=text][placeholder='Name']"),
    m("input.user-name#user-name[type=text][placeholder='Name']")
)

// Placeholder in object, type in selector
Mithril.mount(document.body).render(
    m("input[type=text]", {placeholder: "Name"}),
    m("input[type=text].user-name", {placeholder: "Name"}),
    m("input[type=text]#user-name", {placeholder: "Name"}),
    m("input[type=text].user-name#user-name", {placeholder: "Name"})
)

// All in object minus class name
Mithril.mount(document.body).render(
    m("input", {type: "text", placeholder: "Name"}),
    m("input.user-name", {type: "text", placeholder: "Name"}),
    m("input", {type: "text", id: "user-name", placeholder: "Name"}),
    m("input.user-name", {type: "text", id: "user-name", placeholder: "Name"})
)
```

If you minify it, it's not as large of an increase as you might expect, and most the difference disappears after compression. Here's the above, but each of them minified with their respective sizes.

```js
// 234 bytes minified, 120 bytes min+gzip
Mithril.mount(document.body).render(m("input[type=text][placeholder='Name']"),m("input.user-name[type=text][placeholder='Name']"),m("input#user-name[type=text][placeholder='Name']"),m("input.user-name#user-name[type=text][placeholder='Name']"))

// 238 bytes minified, 121 bytes min+gzip
Mithril.mount(document.body).render(m("input[type=text]",{placeholder:"Name"}),m("input[type=text].user-name",{placeholder:"Name"}),m("input[type=text]#user-name",{placeholder:"Name"}),m("input[type=text].user-name#user-name",{placeholder:"Name"}))

// 252 bytes minified, 125 bytes min+gzip
Mithril.mount(document.body).render(m("input",{type:"text",placeholder:"Name"}),m("input.user-name",{type:"text",placeholder:"Name"}),m("input",{type:"text",id:"user-name",placeholder:"Name"}),m("input.user-name",{type:"text",id:"user-name",placeholder:"Name"}))
```

I tested it out a bundled version of the [ThreaditJS vanilla redesign example](https://github.com/isiahmeadows/mithril.js/blob/redesign-redux/examples/threaditjs/mithril-redesign-vanilla/) to see in a more substantial scenario how it'd change things, and I noticed a couple things:

1. Zero lines of code needed added.
2. When minified with Terser as a module and gzipped (ignoring the build system setup), removing the three attribute selectors actually saved 5 bytes, going from 1315 to 1310 bytes.

With a diff of 3 lines and a slight improvement in code size, it's not actually helping. You're not getting any real gains out of this unless you 1. have a *lot* of JS, 2. are using static selectors almost exclusively, and 3. use a attribute selectors very frequently. And although the gain might seem concerning, it's worth reiterating [Mithril v2's selector parser still takes a sizable chunk of the bundle](https://github.com/MithrilJS/mithril.js/blob/34f4363357356435a865389dabd5fb11f529bb15/render/hyperscript.js#L7-L83), so you're saving bundle size for smaller projects, and the win you'd get in larger projects is likely going to be statistically insignificant at best.

### Approachability

One of the biggest issues that's hindered Mithril's adoption is approachability. I've heard of several companies in the past having issues onboarding new people unfamiliar with the framework, even post-v1, and of several people having issues understanding the documentation simply because of the hyperscript syntax. You don't see that appear much in the Gitter chat room, in blog posts, on Twitter, or in our issues, but [a conversation in our Gitter](https://gitter.im/mithriljs/mithril.js?at=5daef8a19825bd6baca9cadc) itself sheds some light on this. There's this phenomenon called ["survivorship bias"](https://en.wikipedia.org/wiki/Survivorship_bias), and I'm almost certain we hit it. [Elm detected a similar issue with their syntax errors](https://elm-lang.org/news/the-syntax-cliff), and they explained this:

> **Syntax errors are highly concentrated in the first weeks with a language, and people are particularly vulnerable in this time.** When a beginner asks themselves why something is hard, it is easy to think, "Because I am bad at it!" And it is easy to spiral from there. "I heard it was hard. I was not super confident I could do it anyway. Maybe I just suck at this. And if this is what programming feels like, there is no chance I want to be doing this with my life!" **People who fall off the cliff cannot share their perspective in meetups, online forums, conferences, etc. They quit! They are not in those places!**
>
> As for people who make it past the cliff, many do not shake off that initial confidence blow. They use the language, but **not with enough confidence to think that their problems should be handled by a language designer. "Oh, that again. I will never learn!"**
>
> **So language designers never really hear about this problem.** I only understood its magnitude once [`elm/error-message-catalog`](https://github.com/elm/error-message-catalog/issues) got going. That repo solicits confusing error messages in hopes of finding ways to improve. I think projects like that legitimize the idea that "error messages should be better" such that I started hearing from a broader range of people. (Not just the very non-random sample of users that participate online!)

In the above quote, I bolded a few key passages, a few very major things I want to reflect on here. We lack a dedicated repo like they created (linked in the quote and in the original), but I have encouraged people, especially those less established, to post their suggestions in the issues. Already, I have addressed some of the issues at hand - I've improved error messages, killed mixing keyed and unkeyed elements (which uncovered several bugs among users), and made route linking a lot harder to get wrong.

Hyperscript's selector syntax confuses newcomers and only serve to complicate the picture. Those of us experienced with hyperscript selectors can read them fairly quickly, but that's not what most people are used to. Those coming from front-end are used to HTML, and so the CSS selector syntax will only stand to confuse them. Those coming from backend don't usually know CSS, and so they have to learn a full DSL just to learn how to read it, and if they're used to XML (say, they are a former Java or Scala developer), the CSS-style syntax is going to look even more foreign. Native mobile developers learning Mithril are going to similarly struggle with the selector syntax because mobile is so XML-driven on both iOS and (especially) Android, but also because those platforms *don't* deal with classes or CSS at all.

I've also noticed a strong trend of more experienced users specifying most of their attributes as objects and only as necessary specifying classes in the tag name, especially in larger open source apps like [Flems](https://github.com/porsager/flems.io) and [Lichess's mobile site](https://github.com/veloce/lichobile). In addition, Snabbdom, used by [Lichess's main site](https://github.com/ornicar/lila/), features a hyperscript API but doesn't even support attributes at all. This all stands out as a giant red flag to me, in that at the very least the attribute syntax is probably not as useful as it might seem [despite taking most of the actual logic of the selector parser](https://github.com/MithrilJS/mithril.js/blob/34f4363357356435a865389dabd5fb11f529bb15/render/hyperscript.js#L7-L83), and that it likely hinders code readability itself even for more experienced users.

As for classes and IDs: IDs are a known anti-pattern in virtual DOM frameworks, but so few users use them that [React doesn't even single it out in their documentation on DOM attributes](https://reactjs.org/docs/dom-elements.html), despite them singling out [`style`](https://reactjs.org/docs/dom-elements.html#style) to warn about similar issues within *it*.

## Diverging from HTML's structure

I know this is pretty radical. Everyone knows HTML well. This does intentionally diverge in that attributes are now logically considered a type of "child", something that diverges pretty far from HTML and even its siblings like XML and parent SGML.

I'll first start out with this: the mental model does diverge, *but* you can still use `m("div", {...attrs}, ...children)` as usual. So you can keep a strict idiom that still aligns with HTML, even though this redesign won't require you to.

First, it lets you abstract over events easily. You want to watch left clicks with no modifiers? Write a utility `onLeftClick(callback)` that calls `callback` only when it's a left click with no modifiers present. This will also not step on the toes of a sibling `onRightClick` that watches over the same events. It will also continue to work even if `onRightClick` wants to run a passive listener for some unknown reason (and you want to cancel the click with `onLeftClick`).

Second, it lets you group attributes more easily and abstract over them better. Normally, you reuse attributes via `...savedAttrs`, but this isn't bullet-proof:

- You could have a `style`, and `savedAttrs` could also have it. You generally want that *merged*, not *overridden*, but spreading the attribute would do precisely that: overwrite it wholesale.
- Quite often, you don't need just values, but a full template. Normally, you'd do `...someAttrs(foo, bar, baz)` where `someAttrs` returns an attributes object, but this would let you elide that boilerplate.
- Sometimes, the attributes you might need relies on context. In Mithril v2 and prior, there was no concept of context, so it was just relying on global state, but with this redesign, that *can* happen. I've seen it even happen in React.

The ability to group and abstract over groups of attributes with local state is exploited to near insanity for [the transition API](mvp-utils/transition.md) - that userland utility isn't made of magic, even though it might as well be.

And finally, you'll often see the flow of information broken. You'll be reading this tree, reading all the attributes, and suddenly you run into a giant block of barely related code, that of an event listener. People are already frequently using one of two workarounds for this in most frameworks using tree diffing techniques:

1. Saving the function at the beginning or as a class method - this is a common idiom in nearly every JSX and hyperscript in my experience, where the framework allows inline listeners.
1. Completely separating the view and event handler code - this is what Svelte, Vue, Angular, and Elm all do. React Redux users also do this to a broad extent, and React Flare is gearing up to do more or less the same thing.

By simply moving the interesting information to where it's most readable, whether at the end, in the beginning, or in the middle, you ease your ability to comprehend the code. HTML, like nearly every SGML-descended language, doesn't let you do that. Likewise, none of those have syntactic facilities for abstracting over attributes, much less children. And *this* is why I made attributes *children*, something you can specify anywhere.

I was in large part inspired by Dominic Gannaway's work on events for React, but with the mental model shifted to be a little more direct and the abstraction generalized to include attributes as well. Here's a few links for context:

- https://gitter.im/mithriljs/mithril.js?at=5d363870d1cceb1a8da44199
- https://twitter.com/isiahmeadows1/status/1158771013137707009
- https://gitter.im/mithriljs/mithril.js?at=5d49affb475c0a0feb0e4963

## Why this synthetic event system?

1. It's relatively light sugar, and the only thing synthetic about it is bringing a consistent interface between components and events - the rest of the overhead is just for supporting multiple receivers.
2. I explain this at length in [the event documentation](core/events.md#why-change-the-event-receiver-model).

## Making the main bundle heavy with even more batteries included

Mithril is primarily a front-end framework. You're literally gaining nothing in bundle size by installing everything all at once. Plus, it's one dependency and you have it all, instead of 15 different dependencies just to get started. Mithril already has historically baked a lot into the core distribution:

- The core renderer + associated functionality, including `Mithril.mount`
- An XMLHttpRequest wrapper API: `m.request` and `m.jsonp`
- Routing: `m.route`
- Rudimentary state management helpers: `m.prop` in v0.2, `mithril/stream` in v1/v2
- ospec in v1 and (accidentally) partially in v2.

But on top of that, I still see people asking what to do about testing, about rendering to HTML (usually for isomorphic apps), about CSS transition handling, and all of those *have* existing modules and/or patterns, things that we'd see less of if we moved it all into the core repo and published it all as one giant step to npm. It's less hassle for us, less hassle for users.

Note that we would still keep out of core things that can't feasibly be kept *in* core due to naming restrictions, like ESLint's inability to comprehend packages that aren't either `eslint-plugin-*` or `@scope/eslint-plugin-*`. Those would live in separate repos necessarily, and would also be useful for keeping integration-specific modules out of core.

## Removing trusted vnodes

Few reasons:

1. We're one of few frameworks that provide that facility anywhere beyond `innerHTML`, and most everyone else who does that I'm aware of provide it only because their entire view layer is template-driven (like Ember).
2. `.innerHTML` addresses nearly every use case I've ever heard of, and it's worth noting there hasn't been any significant demand for even React to implement it. For the few that actually need the ability to insert HTML/XML adjacent to a particular element, they can just use the native [`Element.insertAdjacentHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML), which deceptively works for both.

## Moving children into the attributes

The vnode children have been moved into the attributes.

This is one of the few things React did *correctly* from the start. It's *much* easier to proxy attributes through when children are packaged like any other attribute. It's also much easier to pass them around sensibly - you don't need to specially package them.

## Why no streams?

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
21. And finally, it should help [make impossible states impossible](https://www.youtube.com/watch?v=IcgmSRJHu_8) and impossible operations unrepresentable.

And on top of these, anything that lets me reduce the existing level of Mithril magic, including removing autoredraw, is only a plus.

And of course, this basically left me with almost nothing that currently existed. So I had to create a new abstraction for it, and eventually narrowed it down to a concept I've called streams, but they're a lower-level, simplified variation of traditional streams. This provides each of these, and [the various `mithril/stream` stuff](core/stream-utils.md) helps make it much more approachable.

Here's some of the existing ways I could've gone about this, and why I didn't.

### Traditional streams and observables

They generally require heavy dependencies to even operate, and even if I went to just accept anything that has a `Symbol.observable` method returning an object with a `.subscribe` method, it *still* would be a bit unwieldy to use.

They also have *some* overhead, and if you want to remove the performance and runtime memory overhead of it, you basically have to trade it for a lot of overhead in the form of bytes being sent over the wire:

- [RxJS 6](https://rxjs.dev): heavily optimized with 100+ operators: 44.5 kB min+gzip
- [Most core](https://github.com/mostjs/core): heavily optimized with a lot of "core" features but few operators: 14.9 kB min+gzip
- [xstream](https://staltz.github.io/xstream/): much smaller and slimmer with only ["hot"](https://medium.com/@benlesh/hot-vs-cold-observables-f8094ed53339) streams, designed for [Cycle.js](https://cycle.js.org/) (a virtual DOM framework driven by reactive streams rather than traditional components): 4.1 kB min+gzip
- [Mithril streams](https://mithril.js.org/archive/v1.1.6/stream.html): very small, but so barebones people are constantly reinventing critical functionality it lacks: 1.0 kB

### Async iterators

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

### Pull streams

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

### Callbags

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

### Hooks

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

There is a [component DSL](component-dsl.md) in large part inspired by hooks and Svelte, but it has several subtle but fundamental differences beyond names that make it work noticeably different in practice from either, and I would rather *not* conflate this with that. It's also designed *as a language* and not *as a library*, so it's much more fluid. Here's how it differs from React's Hooks API:

- You don't specify dependencies, but guard conditions.
- State can be immediate or lazy, but the functionality of the two are distinct and separate, not merged.
- You don't declare effects, but schedule blocks.
- Initialization is explicit and synchronous - you do everything immediately and inline.
    - If you want to cache something, use `memo` + `guard(hasChanged(...), ...)` where appropriate.
    - If you want to do something post-render, return a `m.capture(...)` vnode. It's rarely *not* doing DOM-related stuff, so it really *should* be tied to the DOM anyways. Also, custom helpers should generally *not* be doing stuff to elements without the knowledge of the root component - it's harder to trace mutations and performance issues that way.
- It's more centered around "do" rather than just the "what", and there's a far cleaner separation between the "what" and "do" in the DSL.
- Render context (environment, whether it's the first run, etc.) is exposed in an easily accessible manner, and you can use that to conditionally apply various attributes and such.

> Or to put it another way: 99% of what you can do with React's DSL you can do with the component DSL proposal here fairly directly, but there's several classes of things you can do with the component DSL that you can't do with React Hooks. However, the way you do these things often differ substantially, so it's not advised to code in the same way you might code React Hooks.

### Classes (and equivalent abstractions)

Classes seem like the perfect abstraction on the surface for encapsulating views. It's only natural that a component is just a class with a `view`/`render` method. Composition is easy: just add an object property. They're highly structured and decoupled from other classes in general. They integrate well with the outside world in a variety of ways. Most developers understand the concept of classes, and they're pretty easy to learn the basics of, even if you're a designer who otherwise struggles to grok code in the first place.

But that's approximately where that love letter ends. Because classes suck. Especially for view code because they don't work well with high asynchrony. If they didn't, this whole effort would be a revision, not a redesign.

And in this section, I'm not just talking about classes - I'm talking about every other way you can model that same abstraction, too. No matter how much you simplify it, you might be able to fix some of the common papercuts, but it won't address the underlying problem.

```js
// A class component with inherited explicit redraw
class Counter extends Component {
    constructor(initAttrs) { this.count = 1 }
    view(next, prev) {
        return [
            m("button", {onclick: () => { this.count--; this.update() }}, "-"),
            m("div.count", this.count),
            m("button", {onclick: () => { this.count++; this.update() }}, "+"),
        ]
    }
}

// A class component with implicit global redraw
class Counter {
    constructor(initAttrs) { this.count = 1 }
    view(next, prev) {
        return [
            m("button", {onclick: () => this.count--}, "-"),
            m("div.count", this.count),
            m("button", {onclick: () => this.count++}, "+"),
        ]
    }
}

// A closure component returning an object, with implicit global redraw
function Counter(initAttrs) {
    let count = 1
    return {
        view(next, prev) {
            return [
                m("button", {onclick: () => count--}, "-"),
                m("div.count", count),
                m("button", {onclick: () => count++}, "+"),
            ]
        },
    }
}

// An object component with implicit global redraw
let Counter = {
    oninit(initAttrs) { this.count = 1 },
    view(next, prev) {
        return [
            m("button", {onclick: () => this.count--}, "-"),
            m("div.count", this.count),
            m("button", {onclick: () => this.count++}, "+"),
        ]
    },
}

// A closure component returning a view function, with implicit global redraw
function Counter(initAttrs) {
    let count = 1
    return (next, prev) => [
        m("button", {onclick: () => count--}, "-"),
        m("div.count", count),
        m("button", {onclick: () => count++}, "+"),
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

### State reducers

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
            m("button", {onclick: () => context.update(count - 1)}, "-"),
            m("div.count", count),
            m("button", {onclick: () => context.update(count + 1)}, "+"),
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

### Cells

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

### Others

There's of course other things I've considered, too, even if just briefly, so I'm not going to go into too much detail:

- Reactive cells, RxJS subjects, and similar: All the benefits of reactivity, but with all the usual boilerplate and then some. It's not unlike just using a bunch of atomic variables unnecessarily, and it doesn't scale very well. Also, by this point, it'd be easier just to use streams or observables in many cases, but this is also something I've decided against as explained in detail previously.
- Reactive DSLs: This goes against the entire Mithril mantra of being "just JavaScript". No matter how compelling this might be (especially if defined via rules and relations), that's a *steep* slope to climb, and it isn't always practical for some users. There's also some lack of clarity in when it should be redrawing - if it's all immutable, this decision is easy, but that's not something you can always assume, even in many of those domain-specific languages (like [DisplayScript](http://displayscript.org/) and [Svelte](https://svelte.technology/)). And on top of all this, there's no way you can really do this both performantly and concisely *without* a DSL that *compiles* to JavaScript.
- Pipelines, wires, Node-style streams, and similar: Abstracting computation is nice, but it's not a great fit as a primitive for managing views. Components themselves *could* be treated as such, but pipelines don't easily *nest*, making them mostly unsuitable for views. This is also why components using React Redux are so often boilerplatey and why [Reflex](https://reflex-frp.org/) examples can [sometimes read a bit arcane at times](https://github.com/reflex-frp/reflex-examples/blob/master/frontend/src/Frontend/Examples/BasicToDo/Main.hs) in the way it unnests events, even if you already know how to read Haskell and understand how functional reactive programming works.
- Stateless templates as views and components as view controllers: The separation sounds like a nice idea in theory, but it's not actually that useful in practice, not without a [compile-time step](https://svelte.technology/) that obviously isn't going to happen with Mithril barring some drastic change in community sentiment.

This is by no means a complete list, but it should hopefully show some of the other things I went through before coming around to the abstraction of cells. Plus, this might be able to give you a little bit of insight as to why I arrived at *that* abstraction over various others, and if you do have ideas on how things might be improved, it can serve as a nice start point so [you can at least understand why it's the way it is *first*](https://en.wikipedia.org/wiki/Wikipedia:Chesterton%27s_fence).

## The existence of a hooks-like DSL

While the concept of hooks itself is *not* a good idea, the general concept of a UI that reacts to state changes and stays up to date *is* a good idea to have. Furthermore, this is something that can be easily extended to other things, too, like resources. The value of this concept is why I provided a [hooks-like DSL](component-dsl.md). However, while they look very similar on the surface, they encapsulate an entirely different reactive model, one not driven by dependencies and effects but by conditions, guards, and actions. Or, to put it another way, React's hooks is cell-based while the redesign's DSL is more rule/constraint-based. It also provides a much fuller standard library to encapsulate common operations like async resource requesting and managing events on various global elements.

In React, you might write this:

```js
import {useMemo, useState, useEffect} from "react"

function useLocalStorage(key) {
    const [value, setValue] = useState(window.localStorage.getItem(key))
    const parsed = useMemo(
        () => value ? JSON.parse(value) : undefined,
        [value]
    )

    useEffect(() => {
        const update = (event) => { setValue(event.newValue) }
        window.addEventListener("storage", update, false)
        return () => {
            window.removeEventListener("storage", update, false)
        }
    }, [])

    return [parsed, (value) => {
        window.localStorage.setItem(key, JSON.stringify(value))
    }]
}

function useMatchesMedia(query) {
    const mql = useMemo(() => window.matchMedia(query), [query])
    const [_, update] = useState()

    useEffect(() => {
        const handler = () => update()
        mql.addListener(handler)
        return () => {
            mql.removeListener(handler)
        }
    }, [mql])

    return mql.matches
}

export default function isDarkMode() {
    const prefersDarkMode = useMatchesMedia("(prefers-color-scheme: dark)")
    const [enabled = prefersDarkMode, setEnabled] =
        useLocalStorage("dark-mode-enabled")

    useEffect(() => {
        if (enabled) {
            document.body.classList.add("dark-mode")
        } else {
            document.body.classList.remove("dark-mode")
        }
    }, [enabled])

    useEffect(() => {
        return () => {
            document.body.classList.remove("dark-mode")
        }
    }, [])

    return [Boolean(enabled), setEnabled]
}
```

In my proposed hooks DSL, you might instead write this:

```js
import {
    guard, hasChanged, whenRemoved, isInitial, memo, useInfo, usePortal,
} from "mithril"

function useLocalStorage(key) {
    const value = window.localStorage.getItem(key)
    const parsed = guard(hasChanged(value), () => memo(() =>
        value ? JSON.parse(value) : undefined
    ))

    const info = useInfo()
    usePortal(window, {onstorage: () => info.redraw()})

    return [parsed, (value) => {
        window.localStorage.setItem(key, JSON.stringify(value))
    }]
}

function isMedia(query) {
    return guard(hasChanged(query), () => {
        const mql = memo(() => window.matchMedia(query))

        const info = useInfo()
        whenRemoved(memo(() => {
            const handler = () => info.redraw()
            mql.addListener(handler)
            return () => {
                mql.removeListener(handler)
            }
        }))

        return mql.matches
    })
}

export default function isDarkMode() {
    const prefersDarkMode = isMedia("(prefers-color-scheme: dark)")
    const [enabled = prefersDarkMode, setEnabled] =
        useLocalStorage("dark-mode-enabled")

    usePortal(document.body, {class: {"dark-mode": enabled}})

    return [Boolean(enabled), setEnabled]
}
```

It certainly does have its tradeoffs, as you can tell even in this simple example.

- When you specify things in terms of dependencies, the simple stuff becomes fairly easy to accomplish. For instance, compare the first (JSON extraction) half of the `useLocalStorage` versions between the two: the React version's very simple as it's just about the effect (extraction) + its dependencies, while the redesign variant is substantially more verbose and token-dense because it's specifying all that stuff explicitly.
- When you specify things in terms of conditions, you can much more easily generalize that to larger blocks. In the `isMedia` in the redesign variant, a single block is used to group the entire media query matcher, eliminating the need to specify dependencies at each individual step. In addition, I could access a function that lets me explicitly redraw *without* setting state. In the `useMatchesMedia` in React, I had to specify the query as a dependency and then the query list as a dependency, increasing boilerplate, and I also had to define a state slot just to redraw.
- In the redesign variant, everything happens on the main path, while React shoves as much out as it possibly can. This comes down to a difference in philosophy: React's goal is to control the world and hold the user's hand, while the redesign's goal is to minimize magic and give the user the keys to the kingdom. It's possible to run things asynchronously with `defer`, but this is generally unnecessary and it being a separate function is to *discourage* overuse of it. (For one, most "expensive" things are already guarded with a condition of some sort.)

I'll note that with my proposed DSL, it isn't that hard to write some helpers to recast it in terms of dependencies, and it's *far* more complicated (lots of `useMemo` and `useRef` trickery + a synthetic stack for `guard`/`when`) to do similar for React. Here's the basic `useState`, `useRef`, and `useEffect` implemented below.

```js
import {lazy, ref, isInitial, whenRemoved, hasChangedBy} from "mithril"

// Note: this is just for the sake of making `useEffect` async
const defer = Promise.prototype.then.bind(Promise.resolve())

// Same as `Object.is`, but `+0` is considered to be the same as `-0`. This is
// what maps, sets, `Array.prototype.includes`, and most other similar
// functionality added ES2015 or later.
function sameValueZero(a, b) {
    return a === b || a !== a && b !== b
}

function isUpdated(dependencies) {
    return hasChangedBy(dependencies, (as, bs) =>
        bs != null && bs.every((b, i) => sameValueZero(a[i], b))
    )
}

export function useState(initialState) {
    const [state, updateState] = lazy(
        typeof initialState === "function" ? initialState : () => initialState
    )

    return [state, (newState) => {
        updateState(typeof newState === "function" ? newState : () => newState)
    }]
}

export function useRef(initialValue) {
    const result = ref()
    if (isInitial()) {
        result.current = typeof initialState === "function"
            ? initialState()
            : initialState
    }
    return result
}

export function useEffect(didUpdate, dependencies = undefined) {
    let remove = ref()

    if (isUpdated(dependencies)) {
        whenReady(() => {
            remove.current = didUpdate()
        })
    }

    whenRemoved(() => {
        if (typeof remove.current === "function") remove.current()
    })
}
```

And for convenience, the DSL also has built-in support for dependency-based programming, with a variant of `memo` similar to React's `useMemo` and `useEffect` to work similarly to React's `useEffect`. So in reality, the DSL code would more likely look like this:

```js
import {useEffect, memo, useInfo, usePortal} from "mithril"

function useLocalStorage(key) {
    const value = window.localStorage.getItem(key)
    const parsed = memo(value, () => value ? JSON.parse(value) : undefined)

    const info = useInfo()
    usePortal(window, {onstorage: () => info.redraw()})

    return [parsed, (value) => {
        window.localStorage.setItem(key, JSON.stringify(value))
    }]
}

function isMedia(query) {
    return guard(hasChanged(query), () => {
        const mql = memo(() => window.matchMedia(query))

        const info = useInfo()
        useEffect(() => {
            const handler = () => info.redraw()
            mql.addListener(handler)
            return () => mql.removeListener(handler)
        })

        return mql.matches
    })
}

export default function isDarkMode() {
    const prefersDarkMode = isMedia("(prefers-color-scheme: dark)")
    const [enabled = prefersDarkMode, setEnabled] =
        useLocalStorage("dark-mode-enabled")

    usePortal(document.body, {class: {"dark-mode": enabled}})

    return [Boolean(enabled), setEnabled]
}
```

## Non-support for function children

React supports it and Mithril v2 passes it straight through unmodified. However, this redesign doesn't feature it, and for a few of reasons.

1. Attributes work just fine for most cases.
2. There are still idioms you can use to get nearly all the expressivity back.
3. It doesn't fit within the mental model this redesign was conceptualized from.

Let me distill each of those.

### Attributes

It was pretty far into Mithril v2 when support for function children was first added, and it's because you could always use `view: (...args) => vnode` attributes to generate children. And this still holds today - it's perfectly acceptable to do things this way:

```js
// Hyperscript
m(TrackMouse, {
    view: (x, y) => [...]
})
```

```jsx
// JSX
<TrackMouse view={
    (x, y) => <>...</>
} />
```

This itself was the main reason why I was hesitant to even add support for it in the first place - if you can do it entirely in userland without a ton of issue, there's no need to complicate core for it.

### Alternate idioms

If using attributes is too boilerplatey, there *are* alternate idioms to use, particularly that of a *vnode factory* as opposed to a *component*. It generally goes something like this:

```js
// Hyperscript
trackMouse((x, y) => ...)
```

```jsx
// JSX
<>{trackMouse((x, y) => <>...</>)}</>
```

```js
// Declare
function TrackMouse(ctrl, {view}) {
    // omitted
}

function trackMouse(view) {
    return m(TrackMouse, {view})
}
```

In fact, both the router and transition utilities use such an alternate idiom to cut down on boilerplate.

```js
// Transitions
transition("some-class")
transition({in: "foo", out: "bar", move: "baz", ...})

// Routing
router.match("/", {
    "/": () => m(Home),
    "/profile/:id": ({id}) => m(ShowProfile, {id}),
    "/profile/:id/edit": ({id}) => m(EditProfile, {id}),
})

// Route links
linkTo("/")
```

And in this case, you often might not even need to use components - it's an implementation detail now. This grants you much better API flexibility, as stuff like these usually entail a very small DSL that goes beyond simple configuration, and it lets you better optimize things that aren't really that complicated.

### Mental model

The mental model of children includes attributes as a type of child, and attributes can be added not only immediately but even from within component children's views. This brings a whole host of complexities on its own:

- Should function children be allowed in arbitrary positions, in all but top-level positions within component children, or only shallowly in component vnodes? If the first, this means you have to bake children as a primitive because you can't invoke them in child components until you've rendered their parent, the opposite of how components are rendered normally. You also have to track the parameters to propagate them and invoke all the children correctly, and it'd end up implemented as a second type of context. If the second, you still have to track parameters as a type of context, and you still have to create a new primitive to link children correctly, but you don't have to worry nearly as much about timing. In the third, it's just severely restricted and by that point, it'd be easier to just use a function accepting a view function.
- Attributes in children necessarily *can't* be appended to the list of attributes for that component unless you're careful to apply the children *before* the view gets updated with new attributes (which would render function children quite useless).
- Should DOM elements support function children, and if so, how should they be called? If you call them with an element ref, that would make it so you could completely remove refs entirely (using function children instead), but then that would make certain optimizations much harder and it'd result in some unexpected update ordering. If you just call them immediately while rendering the children, supporting them is pretty useless anyways.
- There's some other issues I'm not going to detail here for brevity.

As you can tell, that request is much more difficult to pull off in this mental model than it is with, say, the traditional model with attributes separated from children. And the more I've thought about this particular feature, the less I feel it's valuable enough to justify its cost adding it to the mental model and modifying it accordingly.
