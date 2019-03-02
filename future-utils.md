[*Up*](./README.md)

# Utilities

These are all various utilities that are, unless otherwise listed, kept out of the core bundle, but they are not considered part of the proposal's MVP.

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
