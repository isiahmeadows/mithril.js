[*Up*](README.md)

# Path templates

This is exposed under `mithril/path` and in the full bundle via `Mithril.p`.

- `p(url, params = {})` - Interpolate `url` as a URL template with `params`.

Note that the [router](#router-api) and [request](#request-api) utilities no longer do their own path interpolation - users should use this instead. Also, note that this carries the semantics in [#2361](https://github.com/MithrilJS/mithril.js/pull/2361) in that `:x` always escapes and `:x...` never escapes.

Also, when appending query parameters, indices are *not* added - it's always generated as `foo[]=a&foo[]=b` for `foo: ["a", "b"]`, not `foo[0]=a&foo[1]=b` as what's currently done. This plays better with most servers, since more accept the first form than the second and the vast majority that accept the second also accept the first.

### Why?

It's much easier and more predictable for both the library and users if path templates are resolved separately from APIs that accept paths. Also, users might want to use it with third-party apps.

### What about `m.buildQueryString` and `m.parseQueryString`?

Those would still be available via `mithril/querystring`, but not from the core or full bundle.
