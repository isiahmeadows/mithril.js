[*Up*](README.md)

# Path templates

This is exposed under `mithril/path` and in the full bundle via `Mithril.p` and `Mithril.path`.

- `p(url, params = {})` - Interpolate `url` as a URL template with `params`.

Note that the [router](#router-api) and [request](#request-api) utilities no longer do their own path interpolation - users should use these instead.

### Function syntax

The syntax for `p(url, params?)` slightly differs from what's in v2, particularly for query and hash strings.

- `:x` always escapes and `:x...` never escapes. This is the same as in v2, but different from v1. If you need literally `params.x` followed by `"..."`, `":..."`, or so on, prepend it with an extra colon like in `:x:...` for `escapeURIComponent(params.x) + "..."`.
- Arrays are serialized with implied indices. In v2, `{foo: ["a", "b"]}` serializes to `?foo[0]=a&foo[1]=b`, but in this, it serializes to `?foo[]=a&foo[]=b`.
    - This plays better with most servers, since nearly all of them accept the form with implied indices, but many don't correctly interpret the form with explicit indices.
- Booleans are serialized by presence. In v2, `{foo: true, bar: false, baz: 1}` serializes to `?foo=true&bar=false&baz=1`, but in this, it serializes to `?foo&baz=1`.
    - This plays better with API expectations, where booleans are usually denoted by presence/absence rather than an explicit value.
- Hashes in variadic parameters are preferred over hashes in the template.
- Duplicate query parameter paths from the template string are removed and overwritten by query parameters, except for arrays which are concatenated and objects which are merged.
    - This just reduces the length of most URLs.

### Why?

It's much easier and more predictable for both the library and users if path templates are resolved separately from APIs that accept paths. Also, users might want to use it with third-party apps, and this provides a convenient utility to do so.

### What about `m.buildQueryString` and `m.parseQueryString`?

Those would still be available via `mithril/querystring`, but not from the core or full bundle.
