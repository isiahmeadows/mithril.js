[*Up*](README.md)

# Path templates

This is exposed under `mithril/path`.

- `p(url, params = {})` - Interpolate `url` as a URL template with `params`. Exposed as `Mithril.p` from the full bundle.
- `` path `https://hostname/${key}/${rest}...?param=${value}&${raw}...` `` - Interpolate a URL using a path template. Exported only from the module itself as the parsing is a little complicated.

Note that the [router](./router.md) and [request](./request.md) utilities no longer do their own path interpolation - users should use these instead.

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

### Template tag syntax

This has a unique syntax that's well-suited for modern browsers and intuitive usage, but it's considerably more complicated to parse and process performantly, hence why it's not in the core or full bundles.

- `${x}` always escapes and `${x}...` never escapes. This is the same as in v2, but different from v1. If you need literally `x` followed by `"..."`, `"$..."`, or so on, prepend it with an extra dollar sign like in `${x}$...` for `escapeURIComponent(x) + "..."`.
- Objects are serialized with their values repeated. `?foo=${{a: 1, b: 2}}` serializes to `?foo[a]=1&foo[b]=2`.
- Objects can be directly interpolated in query strings. `?${{a: 1, b: 2}}` serializes to `?a=1&b=2`.
- Arrays are serialized with implied indices. `?foo=${["a", "b"]}` serializes to `?foo[]=a&foo[]=b`.
- Booleans are serialized by presence. `?foo={true}&bar={false}&baz={1}` serializes to `?foo&baz=1`.
- Duplicate query parameters prefer the latest parameter added. This is to reduce the length of most URLs.

### Why?

It's much easier and more predictable for both the library and users if path templates are resolved separately from APIs that accept paths. Also, users might want to use it with third-party apps, and this provides a convenient utility to do so.

### What about `m.buildQueryString` and `m.parseQueryString`?

Those, being not broadly useful on their own with an API like this, would disappear and become purely internal implementation details. The heavier path-building API provides the right utility for all but the most advanced of use cases. Plus, `m.parseQueryString` is more tied to route dispatch than path building, and in the few cases where it's actually useful, it's almost exclusively server-side, consuming URL-encoded data (mainly with traditional HTML forms).
