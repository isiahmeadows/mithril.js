[*Up*](./README.md)

# TODOs

These are things I need to do at some point, but just haven't gotten to yet. Obviously, this is not exhaustive, but it should give some insight into my plans.

- Ensure the minified source bundle is generated with Terser option `inline: 0`.
	- This can be dropped pending https://github.com/terser-js/terser/issues/350

- Update the vnode/IR structure to reflect current internal tag names.

- Update vnode structure docs to include I plan to use something similar to Inferno for the keyed diff
	- https://github.com/infernojs/inferno/blob/master/packages/inferno/src/DOM/patching.ts
	- Use `result` directly from the LIS algorithm and just return the length to iterate. That way I can keep it fully amortized zero-allocation.
	- Look into Inferno's idea of copying to an integer array - Keys are normalized to integers already, so I can take advantage of the fact engines have optimized representations of sparse integer arrays.
		- I could do this during the type-checking part.
	- Iteratively patch the largest chunks at the beginning and end that match an iterative diff.
		- The beginning is patched before the middle, but the middle is patched before the end.
		- This converts an `O(n log n)` problem to an `O(n)` problem for the 99% cases of no change and of a single addition/replacement/removal.

- Add component for carousels/slides/page transitions
	- Will require keeping both pages live during the transition
	- Will require "page"/"slide" containers to be actual elements (avoids the need to procedurally splice IRs in and out of other IRs)
	- Will have to wrap the router to retain the previous route, so it can properly emit that.
	- Very much so *not* going into the full bundle
	- By option, keeps previously visited components live on a detached fragment
	- Will require ???
	- What primitives are required for this?

- Benchmark streams vs other alternatives detailed in [the rationale](rationale.md#creating-the-cell-abstraction), especially the other stream libraries.
	- This will likely be among the fastest, but it might not be *the* fastest.

- Move all this design documentation to a `design/` subfolder and prototype this.

- Draft a tested migration utility from v2 to this, prior to filing any sort of pull request.

- Document what my inspirations were
	- Similar inspirations to that of state reducers, like Redux and React Hooks
	- Also: https://cycle.js.org/
	- Also: Glimmer VM and [Imba](https://medium.freecodecamp.org/the-virtual-dom-is-slow-meet-the-memoized-dom-bb19f546cc52) in spirit
	- Also: HDL languages like Verilog (which only have explicit input and output parameters)
	- Also: actors and continuation-passing style somewhat directly
	- Also: dataflow programming and stream processing in general
	- Also: functional programming in general. This is truly functional and reactive, at a deeper level than even Elm. (Really, this is closer to Scheme/OCaml territory.)

- Run a poll to see what browsers Mithril actually runs in, so I can get a better picture of how popular it really is and what the baseline actually needs to be.
	- I would like to know actual analytics numbers/estimates per browser as well as what app/company so I can ensure responses can be accurately deduplicated.

- Maybe later show how this API is more easily interfaced with languages other than JS.
	- It'd certainly be interesting to have a serious and decent interop story with languages that aren't JS.
	- Kotlin will likely be the easiest, but it's object oriented enough it'd take a few hacks to make it work. (It fully supports npm modules and similar, and has a *good* JS interop story.) I'm personally much more familiar with this language than the two others listed below, so if I were to experiment, this would be the first I'd try.
	- OCaml/Reason + BuckleScript won't be *as* easy, but it won't be hard aside from the extensive PPX boilerplate. BuckleScript's ecosystem already largely works with npm by default, and you have to go out of your way to work with *OCaml's* package manager OPAM, so that part's easy.
	- ClojureScript could technically just use Mithril directly, but a wrapper function sugaring over the hyperscript API would be highly useful. ClojureScript dependency management is complicated, particularly in the area of npm modules (the [CLJSJS package](https://clojars.org/cljsjs/mithril) is horribly out of date, and [JS module support is only in alpha](https://clojurescript.org/reference/javascript-module-support)), so it's probably not *quite* the ideal choice to experiment initially.
