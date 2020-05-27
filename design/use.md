[*Up*](./README.md)

# Async data

This is exposed under `mithril/use`.

- `m(Use, {init, pending, ready, error})` - Use an async resource, exported from the full bundle as `Mithril.Use`
    - `init(signal)` returns a promise.
        - `signal` is an `AbortSignal` instance, whose backing `AbortController` is constructed via `info.window.AbortController`.
        - `init`'s call is deferred to the next microtask, in case it's sufficiently expensive to perform, so it doesn't interfere with rendering performance.
    - `pending()`, `ready(result)`, and `error(error)` returns a view in accordance with that given state.
        - The default for `error` is to throw (and propagate fatally) its error, and the default for the rest are to just return `undefined`
        - The `pending` attribute is used for the view until the promise resolves or rejects.
        - The `error` attribute is used for the view after the promise is rejected, called with the value it was rejected with.
        - The `complete` attribute is used for the view after the promise is resolved, called with the value it was resolved with.
    - Note: `pending`, `ready`, and `error` work the same way as [the parameters to `result.match(...)` in the component DSL](component-dsl.md#async-data), and `init` is the same as that function's sole parameter.

- `m(UseAll, {init, pending, ready, error})` - Use multiple async resources concurrently
    - `init(signal)` returns an array of promises.
        - `signal` is an `AbortSignal` instance, whose backing `AbortController` is constructed via `info.window.AbortController`.
        - `init`'s call is deferred to the next microtask, in case it's sufficiently expensive to perform, so it doesn't interfere with rendering performance.
    - `view([...results])` returns a view using the given results, where `results` is an array of [results sharing the same interface as the return value of `use(...)` in the component DSL](component-dsl.md#async-data).
    - This exists for more complex scenarios, but as it's pretty complicated and most uses can suffice without it, it's not included in the full bundle.

### Why?

1. It's a *very* common operation that people *will* want sugar for, and it's one I've found myself *frequently* needing.

It's one of those things people need but often don't realize they need. Few frameworks actually provide this, but it's used *extensively* in those that do (like Svelte).
