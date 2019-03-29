[*Up*](./README.md)

# TODOs

These are things I need to do at some point, but just haven't gotten to yet. Obviously, this is not exhaustive, but it should give some insight into my plans.

- Make sure [the non-features page](non-features.md) is actually complete. I've got two, but I know there's a few more that I need to add, like:
	- Ref combinators (see Git history for source)
	- Others I'm probably forgetting

- Benchmark cells vs other alternatives detailed in [the rationale](rationale.md#creating-the-cell-abstraction), especially the other stream libraries.

- Document what my inspirations were
	- Similar inspirations to that of state reducers, like Redux and React Hooks
	- Also: https://cycle.js.org/
	- Also: Glimmer VM and [Imba](https://medium.freecodecamp.org/the-virtual-dom-is-slow-meet-the-memoized-dom-bb19f546cc52) in spirit
	- Also: HDL languages like Verilog (which only have explicit input and output parameters)
	- Also: actors and continuation-passing style somewhat directly
	- Also: dataflow programming and stream processing in general
	- Also: functional programming in general. This is truly functional and reactive, at a deeper level than even Elm. (Really, this is closer to Scheme/OCaml territory.)

- Resolve that README TODO eventually.

- Run a poll to see what browsers Mithril actually runs in, so I can get a better picture of how popular it really is and what the baseline actually needs to be.
	- I would like to know actual analytics numbers/estimates per browser as well as what app/company so I can ensure responses can be accurately deduplicated.

- Maybe later show how this API is more easily interfaced with languages other than JS.
	- It'd certainly be interesting to have a serious and decent interop story with languages that aren't JS.
	- Kotlin will likely be the easiest, but it's object oriented enough it'd take a few hacks to make it work. (It fully supports npm modules and similar, and has a *good* JS interop story.) I'm personally much more familiar with this language than the two others listed below, so if I were to experiment, this would be the first I'd try.
	- OCaml/Reason + BuckleScript won't be *as* easy, but it won't be hard aside from the extensive PPX boilerplate. BuckleScript's ecosystem already largely works with npm by default, and you have to go out of your way to work with *OCaml's* package manager OPAM, so that part's easy.
	- ClojureScript could technically just use Mithril directly, but a wrapper function sugaring over the hyperscript API would be highly useful. ClojureScript dependency management is complicated, particularly in the area of npm modules (the [CLJSJS package](https://clojars.org/cljsjs/mithril) is horribly out of date, and [JS module support is only in alpha](https://clojurescript.org/reference/javascript-module-support)), so it's probably not *quite* the ideal choice to experiment initially.
