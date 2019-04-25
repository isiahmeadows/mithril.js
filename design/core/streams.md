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

### Sugar API

Since it's so integral to the API, a `createStream` method is exported from `mithril/m` and exposed as `Mithril.createStream`. This implements a very simple, stripped-down observable API that's literally 29 significant lines of source code:

- `stream = createStream(init)` - Create a stream.
	- `init` accepts an `observer` and can return either a callback function or an object with an `unsubscribe` method (like a `sub`).
- `sub = stream({next?, error?, complete?})` - Subscribe to the stream.
- `sub()` - Close the subscription.
- `observer.next(value)` - Send a value.
- `observer.error(value)` - Close the underlying subscription and send an error.
- `observer.complete()` - Close the underlying subscription and send a completion.

This implements most of the core functionality of [the proposed ES observables](https://github.com/tc39/proposal-observable), but it lacks the following:

- `sub.closed` and `observer.closed` - you can track those easily enough yourself. The first just involves a subscription-side variable and the second just involves a single initializer-side variable.
- The use of shared prototypes - everything's inside a closure instead.
- `Symbol.observable` - it doesn't attempt to polyfill anything on its own.

It also deviates from that by exposing them as functions instead of objects.

This module, when bundled standalone, is a little under 600 bytes of pure ES3 mod a `"use strict"` declaration, and that's including all of Rollup's wrapper junk.

### Why?

There's a few reasons:

- Components can be functions from a stream of attributes to a vnode tree, so lifecycle hooks naturally fall from the model.
- This is part 1 of our answer to React Hooks, just substantially lower in overhead. And hey, you don't actually *need* a library to use this.
- Most streaming needs can directly translate to this.

Also, there's a handful of helpers [here](https://github.com/isiahmeadows/mithril.js/tree/redesign/helpers) based on [some of these hooks](https://usehooks.com/), in case you want to know what it could look like in practice. Some of those use [some built-in utilities](../mvp-utils/stream.md).

### What about v2 streams?

Mithril v2's streams require an explicit library. This skips all the overhead of connecting streams and just requires a flexible convention to maintain. Plus, this allows targets to not be terminable without an error, something component attributes leverage to force you to always be ready to receive updates.
