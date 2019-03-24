# TODOs

These are things I need to do at some point, but just haven't gotten to yet. Obviously, this is not exhaustive, but it should give some insight into my plans.

- Document what my inspirations were
    - Similar inspirations to that of state reducers, like Redux and React Hooks
    - Also: https://cycle.js.org/
    - Also: Glimmer VM and [Imba](https://medium.freecodecamp.org/the-virtual-dom-is-slow-meet-the-memoized-dom-bb19f546cc52) in spirit
    - Also: dataflow programming and stream processing in general
    - Also: functional programming in general. This is truly functional and reactive, at a deeper level than even Elm. (Really, this is Scheme/OCaml territory.)

- Document my proposed hooks API
    - It will resemble React's API, but it won't be an exact clone.
    - No `setState((prev) => next)` - use a reducer if you really want to do that.

- Resolve that README TODO eventually.

- Reconsider whether normalizing DOM attributes to an array *really* helps. (I'm pretty sure it *would*, but only under limited circumstances.)

- Maybe later show how this API is more easily interfaced with languages other than JS.
    - It'd certainly be interesting to have a serious and decent interop story with languages that aren't JS.
    - Kotlin will likely be the easiest, but it's object oriented enough it'd take a few hacks to make it work. (It fully supports npm modules and similar, and has a *good* JS interop story.) I'm personally much more familiar with this language than the two others listed below, so if I were to experiment, this would be the first I'd try.
    - OCaml/Reason + BuckleScript won't be *as* easy, but it won't be hard aside from the extensive PPX boilerplate. BuckleScript's ecosystem already largely works with npm by default, and you have to go out of your way to work with *OCaml's* package manager OPAM, so that part's easy.
    - ClojureScript could technically just use Mithril directly, but a wrapper function sugaring over the hyperscript API would be highly useful. ClojureScript dependency management is complicated, particularly in the area of npm modules (the [CLJSJS package](https://clojars.org/cljsjs/mithril) is horribly out of date, and [JS module support is only in alpha](https://clojurescript.org/reference/javascript-module-support)), so it's probably not *quite* the ideal choice to experiment initially.
