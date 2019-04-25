[*Up*](./README.md)

# Legacy features

There's a variety of v1/v2 features that will be considered legacy. I will continue to support some of them, purely for the purpose of legacy support, but they won't all be in the same place they once were.

## Mithril v1/v2 streams

This will be maintained and exposed under `mithril-stream`, evolved separately from Mithril itself. It's deprecated in favor of the new streams, as they offer more functionality with less overhead and they are just all around easier to define, easier to use. They're smaller when compressed, too, so that's even more reason to switch to the new streams. It's also why I include the new streams in core and not the old streams.

The API will generally remain the same and it will still remain within the main Mithril repo, but it is still deprecated.

## ospec

This will be maintained and exposed under `ospec` as it is today. It will *not* be shipped in the core bundle, as is also the case today. It'll still be in the main repo, but Mithril core's tests won't use ospec - only the legacy modules will.

## Mithril's DOM mocks

Those will be removed from the distribution as they were never intended to be that way in the first place. The new tests will use the DOM directly as necessary, using JSDOM in Node where applicable.

# `m.buildQueryString` and `m.parseQueryString`

I will still expose them via named exports of `mithril/querystring` for legacy reasons, but they will not be available in the full bundle. `mithril/path` uses a separate implementation to do things a little differently.
