[*Up*](./README.md)

# Non-MVP Utilities

These are all various utilities that are, unless otherwise listed, kept out of the core bundle, but they are not considered part of the proposal's MVP.

## State utilities

This is exposed in `mithril/state` to help you manipulate state reducers and state reducer factories more easily.

- `reducer = State.join({...reducers}, ({...values}, refs) => ...)` - Join multiple reducers in an object into a single reducer with each named by property
    - The resulting reducer emits objects for its refs and children
    - If the callback is omitted, it defaults to the identity function

- `reducer = State.all([...reducers], ([...values], refs) => ...)` - Join multiple reducers in an array into a single reducer with each named by index
    - The resulting reducer emits arrays for its refs and children
    - If the callback is omitted, it defaults to the identity function

- `result = State.run(value, ...funcs)` - Run a value through a series of functions.
    - Basically sugar for `funcs.reduce((x, f) => f(x), value)`
    - Once JS has a [pipeline operator](https://github.com/tc39/proposal-pipeline-operator/), this becomes less necessary.
    - This is useful for creating a pipeline of reducer transforms.

- `reducerFactory = State.pipe(...reducerFactories)` - Compose a series of state reducer factories
    - If a reducer returns `null` or `undefined` as its ref, the previous one is passed in its place.
    - If a later reducer updates, previous reducers' factories are skipped. This avoids unexpected state updates when none was expected.
    - If no reducer factories are passed, this returns the identity state reducer factory.
    - If only one reducer factories is passed, this returns the reducer directly.
    - Conveniently, you *can* create components this way.

- `reducerFactory = State.id()` - Return an identity state reducer factory.

- `reducer = State.map(oldReducer, (value, ref) => newValue)` - Transform a reducer's return value.
    - Refs are sent through without modification.

- `reducer = State.tap(reducer, (value, ref) => newValue)` - Return a reducer that runs a reducer and invokes a function on each emitted value.

- `reducer = State.of(value)` - Create a reducer always returning a constant.

- `reducer = State.setRef(oldReducer, ref)` - Set a reducer's ref.

- `reducer = State.chain(oldReducer, (value, ref) => newReducer)` - Take a ref's value and pipe its value through a new function and return a new ref wrapping its return value.
    - You might recognize this function shape and maybe even its name. Yes, it's a flat-map/monadic bind.

- `reducerFactory = State.when(cond, (ref) => cons, (ref) => alt)` - When `cond` is truthy, invoke `cons` with the value, else invoke `alt` with the value.
    - If either is omitted, it defaults to emitting `undefined` instead.

- `reducer = State.watch(value, init, compare)` - Detect the reducer factory's lifecycle.
    - `init(context, prev, value)` - Called on first load and on change. Returns a `{value, ref, done}` object where `value` is passed along as the value, `ref` is passed along as the ref, and `done` is called on next update or on `done`.
    - `compare(prev, value)` - Called to check if a value is the same. Defaults to `(a, b) => a === b`.
    - This returns the current value.

- `reducer = State.watchAll(values, init, compare)` - Mostly sugar for `State.watch(values, init, arrayEqual)`, but lets you customize the array equality.

- `State.arrayEqual(a, b, compare)` - The implementation used for `State.watchAll`, but exposed in case it's useful.

This is implemented [here](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/state.mjs), with an optimized implementation [here](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/src/optimized/state.mjs).

### Why?

A few reasons:

- The basic design pattern is pretty nice for simple stuff, but it won't scale too far.
- Components are state reducer factories, so this could sugar creating some of them, especially when you chain.
- This is what would be our answer to React Hooks, just substantially lower-overhead.

Also, there's a handful of helpers [here](https://github.com/isiahmeadows/mithril.js/tree/v3-redesign/helpers) based on [some of these hooks](https://usehooks.com/), in case you want to know what it could look like in practice.

### Open questions

1. Should this be part of the MVP? Most of the real power gained from using state reducers ends up centralized into this module. The main concern I have is that we'll have to teach it to people first, almost right out the gate. It's counterintuitive at first, but not in the same way hooks are. However, writing the necessary primitives isn't much easier, and I've seen already how primitives are easy to screw up, just while writing the utility library.

## List diff

This is exposed under `mithril/list-diff`, and is useful when you need to apply Mithril's diffing algorithm before actually rendering the list. This is out of core because the internal diff/patch algorithm is actually stateful and operates on the IR directly, while this is necessarily a separate, second implementation emulating it for simple immutable lists of objects.

- `diff = new ListDiff.Keyed(initialValues, getKey?)` - Create a keyed diff tracker
- `diff = new ListDiff.Unkeyed(initialValues, getType?)` - Create a typed diff tracker
- Diff trackers:
    - `diff.all` - Get the list of all values.
    - `diff.isRemoved(index)` - Get whether the value at `diff.all[index]` is being removed.
    - `diff.update(nextValues)` - Update for next list of values
    - `diff.flush()` - Flush last update
    - `diff.scheduled` - Get the number of yet-to-be-flushed updates

Notes:

- Keys are treated as object properties, just like keys in Mithril's internal keyed diff algorithm.
- Types are compared by referential identity, just like keys in Mithril's internal unkeyed diff algorithm.
- Internally, I'd do a form of generational mark-and-sweep:
    - When adding a key, it starts at the global diff counter.
    - I'd increment all retained values' counters on update.
    - On flush, I'd remove all counters at 0 and then decrement the global diff counter and all remaining value counters.

This is *not* part of the MVP, but exists as part of the necessary standard library. It's a separate unit because it's hard to get right, but several relatively low-level async things like lists of transitioned elements and lists of elements linked to remote resources need it to perform proper caching aligning with Mithril's internal behavior.

## Async list management API

This is exposed under `mithril/async-list` and depends on `mithril/list-diff`.

- `m(AsyncKeyed, {init, destroy, values}, (value, index, data) => child)` - Define a keyed list of async elements
    - `values:` - The current list of values.
    - `init:` - An optional function taking a value and a cancellation scheduler and returning a promise resolving with the loaded data.
    - `destroy:` - An optional function taking a resource and returning a promise resolving after its destruction.
    - `children:` - A function accepting a value + index + data object (`undefined` if currently loading) and returning a keyed child. If the child is being removed, the index is -1, otherwise it's relative to the current `values`.

- `m(AsyncFragment, {init, destroy, values}, (value, index, data) => child)` - Define a keyed list of async elements
    - `values:` - The current list of values.
    - `init:` - An optional function taking a value + cancellation scheduler and returning a promise resolving with the loaded data.
    - `destroy:` - An optional function taking a value + resource and returning a promise resolving after its destruction.
    - `children:` - A function accepting a value + index + data object (`undefined` if currently loading) and returning an unkeyed child. If the child is being removed, the index is -1, otherwise it's relative to the current `values`.

Notes:

- While an element is being destroyed, if it's re-added without being removed, the removal is awaited before it's reinitialized.
- While an element is being destroyed, if it's re-added and removed again during that process, those cancel each other out and no addition is attempted.
- This doesn't depend on `mithril/async` because it would have to reimplement a lot of it anyways and it can do some more intelligent request batching.

### Why?

1. Some remote views entail lists of values, so this would simplify that a lot.
1. Some things, like transitions, rely on async stuff. In fact, `mithril/transition-list` uses this to reduce that to a very simple utility.
1. This is just generally hard to get right because of all the various async edge cases.

## List transition API

This is exposed under `mithril/transition-list` and depends on `mithril/async-list` and `mithril/transition`.

- `m(TransitionKeyed, {in, out}, children)` - Define a keyed list of transitioned elements
    - `in:` - Zero or more space-separated classes to toggle while transitioning inward.
    - `out:` - Zero or more space-separated classes to toggle while transitioning outward.
    - `children:` - An array of zero or more keyed elements.

- `m(TransitionFragment, {in, out}, children)` - Define an unkeyed list of transitioned elements
    - `in:` - Zero or more space-separated classes to toggle while transitioning inward.
    - `out:` - Zero or more space-separated classes to toggle while transitioning outward.
    - `children:` - A function taking a value and index and returning a keyed element.

Notes:

- The values in `children:` are fed to `m(Transition)` as appropriate.
- Children are removed and re-added as applicable per the rules stated in `m(Transition)`.
- Keys are removed from transitioned elements in `TransitionKeyed` and `TransitionFragment` children when they're actually rendered.

### Why?

1. List transitions aren't easy to get right.
