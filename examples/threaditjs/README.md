[*Up*](../../README.md)

# ThreaditJS Demo

This is a set of [ThreaditJS](http://threaditjs.com/) implementations to show how the redesign compares to Mithril v2, traditional React, and React with their experimental Hooks API. It implements effectively identical functionality, but they come out with dramatically different source features and sizes, particularly the redesign compared to the rest.

- [Mithril redesign](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/mithril-redesign)
- [Mithril v1/v2](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/mithril-v2)
- [React](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/react)
- [React + experimental Hooks API](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/react-hooks)

### Source format

Each source file contains a Rollup config script used to set it up, an `index.html` entry point using the generated bundle, and the `/app.mjs` file used to initialize it. In addition, there's a Babel config and ESLint config for each of the React files since those involve JSX.

They are coded to generally share the same architecture, to keep it as much an apples-to-apples comparison as possible.

### Source sizes

These only include the `/app.mjs`/`/app.js` source files in each variant, and it doesn't include all the common stuff in `/common.mjs` that is largely identical. The totals exclude the usual whitespace-only lines, comment-only lines, and empty lines. The numbers are certainly compelling and intriguing, though.

| Library                    | SLoC | Total |
|:-------------------------- |:----:|:-----:|
| Mithril redesign           | 119  |  133  |
| Mithril v1/v2              | 151  |  174  |
| React                      | 215  |  245  |
| React + experimental Hooks | 179  |  206  |

*SLoC = Significant Lines of Code, if you're not familiar with the acronym.*

If you look at those SLoC numbers, one certainly sticks out to me: how *small* the Mithril redesign code is, despite the fact the app is just a simple, mostly-static web app that I'd normally just use vanilla JS + DOM for. Specifically, it's:

- ~21% smaller than Mithril v1/v2.
- ~45% smaller than React.
- ~34% smaller than React + hooks.

*If you'd like to verify these numbers, just do 1 - (size of redesign's SLoC) / (size of other's SLoC).*

Being half the size of vanilla React for functionally identical code is impressive in of itself (it's not the overly boilerplatey crap that's React Redux glue code), but being 21% smaller than even Mithril v2, which itself strips nearly all the React boilerplate away, is itself pretty impressive.

### Stability

The redesign didn't just stop at being smaller - it also kept me from even having to worry about a whole class of bugs in the process, namely not updating properties and state when I need to:

1. Cancelling requests on sudden, quick route change comes practically for free, so coding support for that was as simple as loading a simple built-in helper and passing that to the request. I had to explicitly code this for the other apps, but the small `abortable` helper from `mithril/dom` made this maybe a small 3-line change to correct for in the redesign variant.
1. Suppose you autolink links to different threads and convert them into just simple routing links. Assuming the router doesn't replace the view entirely, this would let you switch the thread ID directly during diffing, so that case needs handled. In the redesign variant, I didn't even remember this nuance and still got it right by accident, because it just naturally worked out that way. In fact, I would've had to *try* very awkwardly to only fetch the first thread ID. The only two easy mistakes I could've made were either forgetting to deduplicate IDs or forgetting to hook up the request for cancellation, but both of these are only minor, easily-fixed perf bugs, not major functional bug you're up at night trying to fix. It wasn't until after I started typing this up and when studying how the redesign variant worked that I realized I accidentally did the right thing there. The other three are a bit of a different story, and all three of them had to be fixed to update after receiving a new, different ID:
	- The React Hooks variant required me add a new parameter to account for this, equating to a small 4 line change. Note that following the ["rules of Hooks"](https://reactjs.org/docs/hooks-rules.html) wouldn't have gotten me there! (In fact, the recommended ESLint `react-hooks` plugin fix was actually *wrong*.)
	- The Mithril v2 variant would've never triggered the buggy code path, since Mithril replaces the full tree when changing routes and either the old or new route is a component. If I later decided to abstract the page into a generic layout rendered via a route resolver, I would've quickly received a bug report then, because nobody would ever reasonably suspect *that* would unmask any new bugs.
	- The React variant was similar, but the bug would *not* have been masked initially. React Router never replaces its components directly, so this would've quickly shown up in a bug report later - nobody would normally think to double-check that kind of thing. I would *not* have likely noticed this when initially developing the page, though!

In general, *because* the attributes are really a cell, I can't forget to update it. I have to consciously choose *not* to update something when using the core cell utilities. But similarly, I also can flip it around and write a raw control vnode directly, in which I choose *when* to render, if at all. This is the simpler model when dealing with resource loading, since you probably want to do some form of error handling potentially.
