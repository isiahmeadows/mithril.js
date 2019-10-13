[*Up*](./README.md)

# TODOs

These are things I need to do at some point, but just haven't gotten to yet. Obviously, this is not exhaustive, but it should give some insight into my plans.

- Benchmark `string.match(/\S+/g)` + iterating result vs `string.trim().split(/\s+/g)` + iterating result vs manual parsing + merged iteration for `class: "string"`
    - The second is likely to be the slowest as it's potentially creating a temporary string in the process.
    - Dodging the array allocation for the third might be beneficial since these are almost always small strings.

- Allow `class: [...names]` and `class: {name: cond, ...}`
    - Must be valid class names unto themselves - this directly uses `classList.add(name)`.
    - This is partially for convenience, but it internally needs to do similar anyways.
    - Note: classes are merged via `||`, not `&&`. It only takes one condition to return `true` for it to be added.

- For `ctrl.catch`, have each factory do its own `try`/`finally` - it's simpler and [the difference is indiscernible in Chrome and Firefox, and the 25% speedup on the success path in Safari from merging them will still be almost a wash](http://jsben.ch/2mlaB).
    - The catch target will also have to be stored on each event handler error.
    - Also, only replace the handler and set up the `try`/`catch` for the children if `ctrl.catch` is actually called.
    - Note: each handler list replaces all previous handler lists. And unlike attributes, handlers aren't inherited.

- Fuse the corrections in `design/non-redux/` into the `redesign` branch.
    - This can be figured out just by doing `git checkout redesign-redux -- design/non-redux/` from the `redesign` branch and going from there.
    - Also, trusted vnodes are now a renderer concern.
    - `s/compatibile/compatible/` in `m.request`
    - Do other grammar/spell checks throughout it.
    - Change spaces to tabs. (`.eslintrc.js` didn't align with `.editorconfig`)

- Update the `src/` stuff to align with the current `design/`
    - `src/stream.mjs` is up to date
    - `src/internal/abortable.mjs` is up to date, move to `ctrl.async`.
    - `src/path.mjs` and `src/internal/query.mjs` are up to date.
    - Most of the rest are *not* up to date.

- Ensure the minified source bundle is generated with Terser option `reduce_vars: 0`.
    - This can be dropped pending https://github.com/terser-js/terser/issues/350

- Add component for carousels/slides/page transitions
    - Will require keeping both pages live during the transition
    - Will require "page"/"slide" containers to be actual elements (avoids the need to procedurally splice IRs in and out of other IRs)
    - Will have to wrap the router to retain the previous route, so it can properly emit that.
    - Very much so *not* going into the full bundle
    - By option, keeps previously visited components live on a detached fragment
    - Will require ???
    - What primitives are required for this?
    - Maybe look at Flutter?
        - https://flutter.dev/docs/cookbook/animation/page-route-animation
        - https://api.flutter.dev/flutter/widgets/Navigator-class.html
        - https://api.flutter.dev/flutter/widgets/PageRouteBuilder-class.html
        - https://api.flutter.dev/flutter/widgets/Route-class.html

- Benchmark streams vs other alternatives detailed in [the rationale](rationale.md#creating-the-cell-abstraction), especially the other stream libraries.
    - This will likely be among the fastest, but it might not be *the* fastest.

- Move all this design documentation to a `design/` subfolder and prototype this.

- Draft a tested migration utility from v2 to this, prior to filing any sort of pull request.

- Document what my inspirations were
    - Similar inspirations to that of state reducers, like Redux and React Hooks
    - Also: https://cycle.js.org/
    - Also: Glimmer VM and [Imba](https://medium.freecodecamp.org/the-virtual-dom-is-slow-meet-the-memoized-dom-bb19f546cc52) in spirit
    - Also: React Flare
    - Also: HDL languages like Verilog (which only have explicit input and output parameters)
    - Also: actors and continuation-passing style somewhat directly
    - Also: dataflow programming and stream processing in general
    - Also: functional programming in general. This is truly functional and reactive, at a deeper level than even Elm in places. (Really, this is closer to Scheme/OCaml territory.)

- Run a poll to see what browsers Mithril actually runs in, so I can get a better picture of how popular it really is and what the baseline actually needs to be.
    - I would like to know actual analytics numbers/estimates per browser as well as what app/company so I can ensure responses can be accurately deduplicated.

- Maybe later show how this API is more easily interfaced with languages other than JS.
    - It'd certainly be interesting to have a serious and decent interop story with languages that aren't JS.
    - Kotlin will likely be the easiest, but it's object oriented enough it'd take a few hacks to make it work. (It fully supports npm modules and similar, and has a *good* JS interop story.) I'm personally much more familiar with this language than the two others listed below, so if I were to experiment, this would be the first I'd try.
    - OCaml/Reason + BuckleScript won't be *as* easy, but it won't be hard aside from the extensive PPX boilerplate. BuckleScript's ecosystem already largely works with npm by default, and you have to go out of your way to work with *OCaml's* package manager OPAM, so that part's easy.
    - ClojureScript could technically just use Mithril directly, but a wrapper function sugaring over the hyperscript API would be highly useful. ClojureScript dependency management is complicated, particularly in the area of npm modules (the [CLJSJS package](https://clojars.org/cljsjs/mithril) is horribly out of date, and [JS module support is only in alpha](https://clojurescript.org/reference/javascript-module-support)), so it's probably not *quite* the ideal choice to experiment initially.
