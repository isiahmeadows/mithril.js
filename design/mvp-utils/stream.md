[*Up*](README.md)

# Stream utilities

This is exposed under `mithril/stream` and in the full bundle via `Mithril.Stream`. It provides a large set of utilities to complement [the core stream abstraction](core/streams.md).

- `Stream.SKIP` - Return this in place of an emitted value to skip the emit. This is useful with many of the stream operators defined below.
	- Note that this only works for functions that would normally just emit. It does *not* prevent things with explicit emits like from `Stream.merge` from emitting, nor does it get ignored when emitted from a source stream.

- `Stream.create(init)`	- Create a stream with all the various inconsistencies sugared over
	- `init` accepts an `observer` and can return either a callback function or an object with an `unsubscribe` method (like a `sub`).

- `[stream, dispatch] = Stream.store(initial, reducer?)` - Create a reactive state cell with an optional reducer
	- On each received value, this invokes `reducer(prev, value)` if `reducer` is passed, stores the returned value to plug into the next `prev`, and emits that returned value to all subscribers.
	- `dispatch` is a function, not an observer. It works much like `observer.next`.
	- This unnests a lot of otherwise highly nested code.
	- This tracks multiple observers correctly so you don't have to.
	- Invoke `stream(Stream.store)` to get the current value.

- `stream = Stream.all([...sources])` - Join multiple streams in an array into a single stream with each named by index
	- The resulting stream emits arrays for its children.
	- If the callback is omitted, it defaults to the identity function.
	- Received `next` calls from streams are resolved synchronously and emit synchronously if all values have been assigned.

- `stream = Stream.join({...sources})` - Join multiple streams in an object into a single stream with each named by property
	- The resulting stream emits objects for its children.
	- If the callback is omitted, it defaults to the identity function.
	- Received `next` calls from streams are resolved synchronously and emit synchronously if all values have been assigned.

- `stream = Stream.lift([...sources], func)` - Sugar for `Stream.map(Stream.all(sources), func)`
	- This is often easier and less boilerplatey.

- `result = Stream.run(value, ...funcs)` - Run a value through a series of functions.
	- Basically sugar for `funcs.reduce((x, f) => f(x), value)`.
	- Once JS has a [pipeline operator](https://github.com/tc39/proposal-pipeline-operator/), this becomes less necessary.
	- This is useful for creating a pipeline of stream transforms.

- `stream = Stream.map(stream, (value) => newValue)` - Transform a stream's return value.
	- To filter a stream, use `Stream.map(stream, (value) => func(value) ? value : Stream.SKIP)`
	- For sugar, `Stream.map(stream, "key")` is equivalent to `Stream.map(stream, (v) => v.key)`. This sugar works with strings, symbols, and numbers all three.
	- Errors thrown from the mapping function are caught and propagated as `error`s.

- `stream = Stream.distinct(stream, compare?)` - Filter distinct (unchanged from previous) values from a stream.
	- `compare(prev, value)`- Called to check if a value is the same. Defaults to `(a, b) => a === b || Number.isNaN(a) && Number.isNaN(b)`, the algorithm for SameValueZero.
	- For sugar, `Stream.distinct(stream, "key")` is equivalent to `Stream.distinct(stream, (a, b) => sameValueZero(a.key, b.key))`, where `sameValueZero` is the default comparison function as specified above. This sugar works with strings, symbols, and numbers all three.
	- Errors thrown from the comparison function are caught and propagated as `error`s.
	- Ordinarily, this wouldn't justify itself in the MVP, but it makes for a very easy `onbeforeupdate` replacement.

- `stream = Stream.merge(...sources)` - Create a stream that emits when one of a variety of streams merge.

- `stream = Stream.chain(stream, (value) => newStream)` - Take a stream's value and pipe its value through a new function and return a new stream wrapping its return value.
	- You might recognize this function shape and maybe even its name. Yes, it's a flat-map/monadic bind.
	- For sugar, `Stream.chain(stream, "key")` is equivalent to `Stream.chain(stream, (v) => v.key)`. This sugar works with strings, symbols, and numbers all three.
	- Errors thrown from the mapping function are caught and propagated as `error`s.
	- Note: this closes previously created streams before initializing the next one. If that's not what you intend, create a custom stream that delegates to this.

- `stream = Stream.onClose(stream, done)` - Return a stream that invokes a `done` callback on the first of `complete`, `error`, or unsubscription. It's not unlike a `finally` equivalent for streams.
	- Errors thrown from `done` are converted to `error` emits.

- `stream = Stream.recover(stream, (error) => newStream)` - A stream that, on error, switches to `newStream` and emits from that.
	- Unlike `Stream.map` and `Stream.chain`, this does *not* carry the specialized callback sugar.

This is implemented [here](https://github.com/isiahmeadows/mithril.js/blob/redesign/packages/mithril/src/stream.mjs).

Notes:

- Each of these are written to be resilient against synchronous updates.
- None of these have any dependencies on anything other than just the language itself. This means you can freely use this anywhere for all its benefits, without fear.
- And yes, none of the other methods depend on `create`, for memory and performance reasons. (It's technically based on a design pattern, but you should prefer `create` for anything beyond inline dynamic vnodes unless you want to do a lot of looking before you leap.)

### Why?

A few reasons:

- You often want to manipulate streams to new values, but doing it all manually is *very* tedious.
- Components can be functions from a stream of attributes to a vnode tree, so lifecycle hook naturally fall from the model.
- This is what would be our answer to React Hooks, just substantially lower in overhead.
- Most streaming utilities can directly translate to this.

Also, there's a handful of helpers [here](https://github.com/isiahmeadows/mithril.js/tree/redesign/helpers) based on [some of these hooks](https://usehooks.com/), in case you want to know what it could look like in practice.

This utility bundled standalone with `createStream` from `mithril/m` also re-exported, minified, and gzipped, is about 1.7kB, all syntactically valid ES3. This *is* significantly larger than Mithril's existing 0.9kB streams utility. But the names compress a bit better when bundled with other things, especially if you use Rollup, and it ends up resulting in smaller primary source code anyways. So this up-front cost would be amortized in practice and you can use it freely. In addition, it's not like this is still *large* - other "small" stream libraries like [xstream](https://staltz.github.io/xstream/) still take upwards of 4 kB, and even [this minimal ES observable polyfill](https://github.com/zenparsing/zen-observable) is about 2.1 kB after transpiling it (as it's in ES6), bundling it standalone using a single entry point file that's `export {Observable as default} from "zen-observable/src/Observable.js"`, minifying, and gzipping. (I verified this manually as no official numberx exist.)
