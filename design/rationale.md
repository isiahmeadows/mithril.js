[*Up*](./README.md)

# Rationale

There's a lot of big decisions here that require some explanation.

## ES5 syntactic compatibility + runtime polyfillability

As many of Mithril's users are in enterprise, IE compatibility is still a must. And even after IE itself is phased out in 2023, [there's still IE Mode in Edge](https://docs.microsoft.com/en-us/deployedge/edge-ie-mode) that Microsoft's been trying to move enterprise to as a compromise (so they can shut down support for the separate IE binary once and for all).

This doesn't mean much to most users, as increasingly they're able to just use modern browsers. Frameworks, especially remotely major ones like Mithril, don't have this luxury - we're shorting out a *lot* of developers if we drop IE support. [In a world where Internet Explorer 11 still has a greater market share than Safari](https://www.netmarketshare.com/browser-market-share.aspx?options=%7B%22filter%22%3A%7B%22%24and%22%3A%5B%7B%22deviceType%22%3A%7B%22%24in%22%3A%5B%22Desktop%2Flaptop%22%5D%7D%7D%5D%7D%2C%22dateLabel%22%3A%22Trend%22%2C%22attributes%22%3A%22share%22%2C%22group%22%3A%22browserVersion%22%2C%22sort%22%3A%7B%22share%22%3A-1%7D%2C%22id%22%3A%22browsersDesktopVersions%22%2C%22dateInterval%22%3A%22Monthly%22%2C%22dateStart%22%3A%222019-05%22%2C%22dateEnd%22%3A%222020-04%22%2C%22plotKeys%22%3A%5B%7B%22browserVersion%22%3A%22Internet%20Explorer%2011%22%7D%2C%7B%22browserVersion%22%3A%22Safari%22%7D%2C%7B%22browserVersion%22%3A%22Edge%22%7D%2C%7B%22browserVersion%22%3A%22Firefox%22%7D%5D%2C%22hiddenSeries%22%3A%7B%7D%2C%22segments%22%3A%22-1000%22%7D), not everyone can just assume all their users are using a modern browser. Yes, some companies (like SaaS companies) can get away with it as most their users are tech-literate and understand the risks and other issues with IE, but in education, smaller banks, governments, and other places that actively avoid upgrading their tech where they can help it, there's a lot of places that flat out can't avoid it. And yes, psychology is almost certainly at play here.

- Many of them [don't see the immediate need or business justification for upgrading their systems](https://en.wikipedia.org/wiki/Present_bias).
- Many of them [feel too married to their current setup to want to upgrade their systems](https://en.wikipedia.org/wiki/Normalcy_bias).
- Many of them [have poured enough money to feel they've become committed to their current setup, and that upgrading their systems renders their investment worthless](https://en.wikipedia.org/wiki/Sunk_cost).

## ES3 syntactic compatibility

I don't plan to actively test against ES3 engines unless I'm alerted that there's a enough of a user base *still* using IE8 that I need to ignore Microsoft's dropping of support, but I will attempt to keep at least syntactic compatibility so users stuck on severely outdated systems can at least cope with this through sufficient polyfills. Pressure by the OS developer (99% of the time it's Microsoft) and lack of support by them should generally be sufficient.

This is per request by a few people developing for projects on relatively ancient operating systems, who've accepted the need for extra tooling and such. (There's still a few enterprises and government organizations working on migrating away from IE to modern web technologies. These are the places I feel sorry for those cursed with that kind of job, but I respect and understand their situation.)

Also, ES3 syntax is just ES5 minus getters and setters. I've found getters to only be a convenience feature, one I can largely live without. Since most of the library additions for ES5 can be shimmed, and for the few parts that can't, [the failure mode from es5-sham with the parts needed for this redesign](https://github.com/es-shims/es5-shim#may-fail) is acceptable, I don't really need to take any further steps beyond compiling to ES5 and not using getters or setters.

> TL;DR: If you want to use this in an ES3 environment, you'll need to load the following before Mithril:
>
> - [es5-shim](https://github.com/es-shims/es5-shim#shims)
> - [es5-sham](https://github.com/es-shims/es5-shim#shams)
> - [json3](https://bestiejs.github.io/json3/) (safer) or [json2](https://github.com/douglascrockford/JSON-js) (faster)
> - [request-frame](https://github.com/julienetie/request-frame) (invoke `requestFrame("native")` immediately after)
> - An ES6-compatible `Promise` polyfill of your choice
>
> You'll likely also want to load the [HTML5 Shiv](https://github.com/aFarkas/html5shiv) and/or [Modernizr](https://github.com/Modernizr/Modernizr) (which has it bundled in) if you want to use any remotely recent features.

As for reasoning, see above in the ES5, though the biases at play are typically more extreme and once said organizations break free of them, it's often the case that migration equals a complete redesign, something those organizations often couldn't economically support even if they wanted to.

## Why are attributes a type of vnode?

The benefits of this aren't immediately obvious, I know. But it does lead to some radical new paradigms:

- You want to include move transitions? Just add a `transition("list")` to it with appropriate CSS for `.list-in`, `.list-out`, and `.list-move`.
- You want an `m("a")` or `m("button")` to route to a link on click? Use a simple `linkTo("/route")`.
- You want an `m("a")` or `m("button")` to act as a back button? Just drop in a `linkBack()` or `linkTo(-1)`. It's literally that simple.
- You want to set overlay attributes appropriately on a modal, listening to clicks outside it and such? Just drop an `overlay(...)` as a child of your overlay element.

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

And of course, this basically left me with literally nothing that currently existed. I tried creating a new stream-like abstraction, and it wound up very concise, but when I presented the idea to several Mithril community members *familiar with streams already and using v2 streams almost daily*, they found it harder to comprehend because it was too information-dense. In the process of this, I found the only way I could really solve as many as possible is with a compile-time DSL, and while that solves all but one, I could only do it by sacrificing either 3 or the size part of 6. (The component DSL's runtime represents sacrificing library size.) The current component model outside the DSL distills it down to a few key low-level primitives and while it doesn't solve everything, it's a solid compromise that remains reasonably usable in its own right.

For more details on this and other models, [check out this page](why-not-x.md) for more details.

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
    usePortal(window, {on: {storage: () => info.redraw()}})

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
    usePortal(window, {on: {storage: () => info.redraw()}})

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

```js
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

```js
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

## Why were keys changed so drastically?

Well, keys are currently used in one of two ways in nearly every virtual DOM library:

- A list of entries you need to iterate, where you need to track their identity even if they move.
- As a means to manually force a subtree to be replaced.

I decided to separate these two concerns, because of three reasons:

1. People have a habit of overusing keys, and `m.link(id, ...children)` makes it much clearer it's about linking an identity to a subtree. Been fighting this regularly in the Gitter chat room as well as in multiple issues filed against Mithril.
2. It's generally the wrong thing to do to key *some* but not *all* of a keyed list, and me adding that check in Mithril has caught a *lot* more problems than it caused based on all the feedback I got. If you really intend to have separators, you can figure that out manually using an index, but it's such a niche use case to want to interleave keyed and unkeyed subtrees it shouldn't be supported in Mithril itself. If you really need that, fork Mithril to do what you need.
3. The first is a complicated mess that requires very complex, specialized algorithms to efficiently handle, but the second is as simple as an equality check.

And in addition, [this loop](https://github.com/mithrilJS/mithril.js/blob/db277217f88d293aa14154c8f0017675ffe94a9c/render/vnode.js#L16-L23) is not something I want to keep around in a framework. It's ugly, it's slow, and it's just a band-aid to protect users against a common user bug. By splitting these two out and changing how keyed fragments are built, it solves several problems:

- Instead of having to check for all keyed/unkeyed, it's literally impossible by design to make that mistake.
- `m.link` makes it easy and clear when you're binding a state to a subtree, so it's easy to simply swap that out for something else.
- There's nothing to check to see if it's a keyed fragment or an unkeyed one besides just testing a simple integer ID, mitigating most of the performance cliff and complexity associated with it.
- It's much less of a footgun to just `m.link` everything than it is to add `key:`s to v2 fragments, resulting in a *lot* fewer questions coming up regarding them.

## Why the change of syntax with events?

I for several months floated back and forth on whether to use `onevent: ...`, `on: {event: ...}`, deliberating off and on mentally on which one to pick. There's pros and cons to each, and neither are obvious.

- Reasons to stick with `onevent: ...`:
    - It's easier to type.
    - It aligns better with HTML and is thus more familiar.
    - It's easier to scan for individual listeners.
    - It's easier to read in isolation as it only involves two tokens to parse: `on` and the event name.

- Reasons to switch to `on: {event(ev) { ... }}`:
    - It's easier to develop types for. [TypeScript doesn't currently provide a way to match type keys starting with `on`](https://github.com/Microsoft/TypeScript/issues/6579), and Flow also lacks similar functionality.
    - It's easier to scan for internally, and doesn't require any string manipulation to iterate or invoke in. It also requires less branching for similar reasons.
    - It's clearer how event names map to event listeners in the underlying DOM representation, as the name and the `on` are separated with additional tokens.

> I also considered a third option, `m.on({event: ...})`/`m.on("event", ...)`, but while it's very, *very* nice for the runtime, it's far too token-heavy for such a common need. This is also around the time I considered using `m.set({attr: ...})`/`m.set("attr", ...)`, and you can probably guess why I skipped over that harebrained idea.

I've solidified on the second. The first seems better on the surface, but the benefits of that over the second have proven themselves to be minimal:

- It's only marginally more difficult to type when only one listener is present (two braces and a colon, nothing more), and that ease vanishes very quickly with multiple listeners as you aren't having to type `on` repeatedly for each name.
- Aligning with HTML sounds great in theory, as there's fewer things to teach, but it's not paid off without frequent catches in practice. I've noticed a pattern where new people are expecting it to be *too* similar, passing strings and such to it. And I've seen many used to `elem.onfoo` run into other issues, finding it surprising they can't, say, set `vnode.dom.onclick = ...` in `onupdate` and it *not* call the handler they passed in the vnode. (Yes, I've seen this come up in the past, even with more experienced users.)
    - In the React world, nobody sees `onClick` as actually identical to HTML's `onclick` or the DOM's `Element.prototype.onclick`, and the casing convention makes this abundantly clear. (In fact, people are surprised to learn that *any* event name works, provided you case it correctly. Mithril does not suffer from this issue as much, BTW.)
    - Similarly, nobody mistakes jQuery's `$elem.on("event", callback)` as being truly 100% equivalent to the DOM's `elem.addEventListener("event", callback, false)`. They see it as isomorphic, but they do *not* expect everything to be the same, up to and including even the way `callback` is called.
- It's only marginally harder to scan for listeners. In practice, you're not likely to have a variable named `click` or `change` in the same file as a component, and if you do, it's likely to only be 1-2 extra enter key presses to find the listener you need. And that's if you have to search for it - you generally don't need to.
- The simpler tokenization has shown to not really help. People talk about `onclick` events rather than `click` events, and any time they're dealing with custom events from third-party libraries with names that aren't valid identifier names for properties (like `bs.modal.show`), they inevitably get confused. I've seen even people who've used Mithril for years get confused over this fact.

I know this will be controversial, but my focus is on solving long-standing design issues people have had with Mithril. It's simple in many respects, but I've witnessed with this, among others, a superficial simplicity that us regular users understand intuitively, but runs against the intuition of most others.
