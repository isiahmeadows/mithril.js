[*Up*](README.md)

# Request API

This is exposed under `mithril/request` and in the full bundle as `Mithril.request`. It's very similar to the existing API, but with some modifications for simplicity and usability.

- JSONP support is gone. It's basically obsolete now in light of CORS being available on all supported platforms, and our code is easy to just copy if necessary.
- Interpolation support is removed. Use [`p(url, params)`](path.md) instead.
- The `request({url, ...opts})` variant is removed - only the `request(url, opts?)` variant remains. (Picked this one for consistency with routing and `fetch`.)
- This assumes a compatible `XMLHttpRequest` exists.
- A `request.TIMEOUT` constant now exists for people to reliably detect timeouts, without having to pass an explicit option or otherwise complicate request handling. Just check if the error thrown is this constant, and you're good.
- New options:
    - Abort signals can be provided via a `signal:` parameter for compatibility with `fetch`. Such signals are generally created via [`m(Use, ...)`](use.md) or [`use(async () => ...)`](component-dsl.md#async-data).
        - This replaces `xhr.abort()` in the `config:` callback. Don't call that directly - pass `signal:` instead.
    - You can pass use `xhr.on.progress` to observe progress events. It's called with the relevant progress event as `progress({lengthComputable, loaded, total})`.
    - You can pass use `xhr.on.headersReceived` to observe when headers are first received. It's called with the relevant progress event as `headersReceived({status, statusText, headers})`.
    - If you wish to, you can provide a `window:` to retrieve the relevant `XMLHttpRequest`/`FormData` constructors from. Commonly, if you're using JSDOM tests, you may want to do `window: info.window`, where `info` is the relevant component info.
- Changes in options:
    - `xhr` can't be replaced from `config:` anymore, and `config` is just called as `opts.config(xhr)`. Saves a few bytes, and you can always access the URL and options via a closure variable. You can also access the options via `this`.
    - `type:` is removed. It's not that hard to implement it yourself: it's just `Array.isArray(result) ? result.map(i => new opts.type(i)) : new opts.type(result)` where `result` is what you'd otherwise get if you omitted the option.
    - `async:` is gone, since sync requests are practically non-existent anymore and this also happens to return a promise. Also, you haven't been able to fire sync XHRs on the main thread for years at this point, so it's kinda useless to keep around.
    - `responseType:` is now always `"json"`, even if you pass `extract`.
    - You can now return a promise from `deserialize:`.
    - All the requisite functionality of `extract:` was fused into `deserialize:`, and `extract:` was removed.
        - `deserialize(response, {status, statusText, headers}, url)`
    - Most options are now checked via `!= null` rather than `typeof opts.foo === "function"`. Wasn't in the API contract, but it's a thing consistently used in it.
    - For consistency, `onfoo` options are now specified as `on: {foo}` options.
    - Since I filled out everything else XHR provides, `config:` was removed

Beyond that, the API is probably fine as-is.
