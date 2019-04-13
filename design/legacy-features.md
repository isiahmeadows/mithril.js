[*Up*](./README.md)

# Legacy features

There's a variety of v1-v2 features that will be considered legacy. I will continue to support some of them, purely for the purpose of legacy support, but they won't all be in the same place they once were.

## Mithril streams

This will be maintained and exposed under `mithril-stream`, evolved separately from Mithril itself. It's not going to be deprecated or removed as there is a use case for a small streams library, but cells offer a lot more functionality out of the box and are just all around easier to define, easier to use. They're smaller when compressed, too, so that's even more reason to switch to cells. It's also why I include cells in core and not streams.

The API will generally remain the same and it will still remain within the main Mithril repo, but it will be versioned and released independently.

## ospec

This will be maintained and exposed under `ospec` as it is today. It will *not* be shipped in the core bundle, as is also the case today. It'll still be in the main repo, but Mithril core's tests won't use ospec - only the legacy modules will.

## Mithril's DOM mocks

Those will be removed from the distribution as they were never intended to be that way in the first place. The new tests will use the DOM directly as necessary, using JSDOM in Node where applicable.

# `m.buildQueryString` and `m.parseQueryString`

I will still expose them via named exports of `mithril/querystring` for legacy reasons, but they will not be available in the full bundle. `mithril/path` uses a separate implementation to do things a little differently.
