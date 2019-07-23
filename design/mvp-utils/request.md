[*Up*](README.md)

# Request API

This is exposed under `mithril/request` and in the full bundle as `Mithril.request`.

- JSONP support is gone. It's basically obsolete now in light of CORS being available on all supported platforms, and our code is easy to just copy if necessary.
- Interpolation support is removed. Use [`p(url, params)`](path.md) instead.
- The `request({url, ...opts})` variant is removed - only the `request(url, opts?)` variant remains. (Picked this one for consistency with routing and `fetch`.)
- This assumes a compatibile `XMLHttpRequest` exists.
- Abort signals can be provided via a `signal:` parameter for compatibility with `fetch`. Note that anything with an `onabort` property can work for this, not just an abort controller.
	- This replaces `xhr.abort()` in the `config:` callback. Don't call that directly - pass `controller.signal` and invoke `controller.abort()` on the corresponding controller instead, or just use `abortable` from [`mithril/dom`](../core/dom.md).

Beyond that, the API is probably fine as-is after [#2335](https://github.com/MithrilJS/mithril.js/pull/2335) and [#2361](https://github.com/MithrilJS/mithril.js/pull/2361) are merged.
