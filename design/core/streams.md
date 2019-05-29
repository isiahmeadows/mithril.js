[*Up*](README.md)

# Streams

You'll see these referenced quite a bit, so here's a quick explainer.

Streams are simple `(o: {next?, throw?, return?}) => done` functions.

- `done(): any` is called when the stream is being cleaned up. It's simply called, not awaited, so be aware of that.
	- This closes the stream subscription, so subsequent `o.next(value)` and similar calls are then ignored and relevant resources are collected.
	- Note: when changing context (like if the attributes change or similar), this does *not* get called, and the corresponding state is still propagated.
- `o.next(value)` is how you emit values.
	- In vnodes, the `value` is your vnode children. This *may* return a promise resolved after it's handled.
- `o.error(value)` is how you emit and/or propagate an error asynchronously.
	- This lets you easily react to and recover from async errors from things like failed requests.
	- Like ES observables, this implicitly terminates the stream.
- `o.complete()` is how you emit and/or propagate an error asynchronously.
	- This lets you easily react to and recover from async errors from things like failed requests.
- All three methods are required for generic operations, but some streams (like component attributes) support omitting some of them and/or never call them.
- The stream is only initialized once.
- Conveniently, this can be used as a dynamic vnode, and it's special-made for it. You can use these to create simple reactive cells that control their own updating.
- Conveniently, you can pass a generator instance for `o` and react to them appropriately. This is *very* intentional, and is why I chose those methods in particular.

The full type of streams is this:

```ts
type Stream<T, E = Error> = (o: StreamObserver<T, E>) => StreamDone;
type StreamDone = () => any;

interface StreamObserver<T, E = Error> {
	next(value: T): any;
	throw(value: E): any;
	return(): any;
}
```

This is purely a convention commonly used throughout the API. This is heavily inspired by React Hooks, but aims to keep the runtime overhead to a minimum. It also is not present in the core bundle because 99% of uses can generally just be written as a design pattern. And of course, there's a heavy FP inspiration here, but a pragmatic, impure one.

### Why?

There's a few reasons:

- Components can be functions from a stream of attributes to a vnode tree, so lifecycle hooks naturally fall from the model.
- This is part 1 of our answer to React Hooks, just substantially lower in overhead. And hey, you don't actually *need* a library to use this.
- Most streaming needs can directly translate to this.

Also, there's a handful of helpers [here](https://github.com/isiahmeadows/mithril.js/tree/redesign/helpers) based on [some of these hooks](https://usehooks.com/), in case you want to know what it could look like in practice. Some of those use [some built-in utilities](../mvp-utils/stream.md).

### What about v2 streams?

Mithril v2's streams require an explicit library. This skips all the overhead of connecting streams and just requires a flexible convention to maintain. Plus, this allows targets to not be terminable without an error, something component attributes leverage to force you to always be ready to receive updates.

### Why not just use the proposed ES observables?

Well, a few reasons:

1. That proposal is at stage 1, and it's been stagnant for well over a year. I *won't* depend on a proposal that's not stable, and that's one such example.
2. This is stripped down much further, to where it's much simpler to learn. The core ES proposal still includes a lot of frills, while this just takes the essence of the API with not much else.
3. I wanted streams to be a type that I can quickly and easily tell apart from any other virtual DOM node, ideally without even having to check any object members. Functions suit this nicely, and they make for a convenient initialization mechanism, too.

The `Stream.create(init)` utility from [my proposed `mithril/stream`](../mvp-utils/stream.md) sugars over all the inconsistencies in the span of literally 29 lines of code. It alone implements most of the core functionality of [the proposed ES observables](https://github.com/tc39/proposal-observable), but it doesn't implement equivalents for most of the frills:

- `sub.closed` and `observer.closed` - You can track those easily enough yourself through an extra variable.
	- For `sub.closed`, you can define a variable you set whenever `error` or `complete` is called, before you do anything else.
	- For `observer.closed`, you can define a variable in the stream callback itself that you set before you call `observer.error(value)` or `observable.complete()`.
- `Symbol.observable` - I'd rather not include any polyfills here.
- `Observable.of(...values)` - It's not that many lines of code for you to just do `function (o) { for (const value of values) o.next(value); o.complete() }`, and in my experience, it's plainly not a common need to return an observable that just emits a bunch of values immediately in sequence upon subscription.
- `Observable.from(value)` - For iterables, it's a similar story to above. For observables and observable-likes (with `Symbol.observable`), it's a similar story to why I dropped that, but in addition, how often are you mixing observables and streams from different libraries anyways? Worst case scenario, it's just a simple `function (o) { var sub = obs.subscribe(o); return () => { sub.unsubscribe() } }` for most observables.
- `observable.subscribe(next, error?, complete?)` sugar - [By the way the reactions to this issue of mine went](https://github.com/tc39/proposal-observable/issues/194), it's not even certain this will remain in the spec.

It also deviates from the proposal by exposing them as functions instead of objects.
