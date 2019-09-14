[*Up*](README.md)

# Request API

This is exposed under `mithril/request` and in the full bundle as `m.request`. It's very similar to the existing API, but with a few modifications for simplicity and usability.

- JSONP support is gone. It's basically obsolete now in light of CORS being available on all supported platforms, and our code is easy to just copy if necessary.
- Interpolation support is removed. Use [`p(url, params)`](path.md) instead.
- The `request({url, ...opts})` variant is removed - only the `request(url, opts?)` variant remains. (Picked this one for consistency with routing and `fetch`.)
- This assumes a compatible `XMLHttpRequest` exists.
- Changes in options:
    - `xhr` can't be replaced from `config:` anymore, and `config` is just called as `opts.config(xhr)`. Saves a few bytes, and you can always access the URL and options via a closure variable. You can also access the options via `this`.
    - `type:` is removed. It's not that hard to implement it yourself: it's just `Array.isArray(result) ? result.map(i => new opts.type(i)) : new opts.type(result)` where `result` is what you'd otherwise get if you omitted the option.
    - Most options are now checked via `!= null` rather than `typeof opts.foo === "function"`. Wasn't in the API contract, but it's a thing consistently used in it.
- New options:
    - Abort signals can be provided via a `signal:` parameter for compatibility with `fetch`. Note that anything supporting `signal.addEventListener("abort", callback, false)` + `signal.removeEventListener("abort", callback, false)`, where `callback` ignores its attributes, can work for this, not just an abort controller.
        - This replaces `xhr.abort()` in the `config:` callback. Don't call that directly - pass `controller.signal` and invoke `controller.abort()` on the corresponding controller instead, or just use [`ctrl.signal()`](../new/components.md#component-controller).
    - You can pass an `onprogress` property to set `xhr.onprogress`. It's called with the relevant `progress` event as `opts.onprogress(ev)`.
    - If you wish to, you can provide a `window:` to retrieve the relevant `XMLHttpRequest`/`FormData` constructors from. Commonly, if you're using JSDOM tests, you may want to do `window: ctrl.window`, where `ctrl` is the relevant component controller.

Beyond that, the API is probably fine as-is.
