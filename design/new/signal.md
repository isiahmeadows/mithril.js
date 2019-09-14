[*Up*](README.md)

# Signal API

This is exposed purely for utility purposes, mostly for `m.request` outside `ctrl.async` in components, but it also provides a convenient sugar API over `AbortController`s and `AbortSignal`s in other scenarios, like if you're dealing with the native HTML `fetch`. It's exposed under `mithril/signal` and in the full bundle via `m.signal`.

- `signal((cancel) => ignored)` - Create a signal with a simple `cancel()` callback to send an `"abort"` event.

In terms of `AbortSignal`, this is pretty simple, but the actual implementation includes a fallback as well.

```js
m.signal = init => {
    const controller = new AbortController()
    init(() => controller.abort())
    return controller.signal
}
```
