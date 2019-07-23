[*Up*](../README.md)

# MVP Utilities

These are all various utilities that are, unless otherwise listed, kept out of the core bundle, but they are part of the MVP of this proposal.

- [Path templates](path.md)
- [Router API](router.md)
- [Request API](request.md)
- [Transition API](transition.md)
- [String renderer](string.md)
- [Resolver renderer](resolver.md)

## Full bundle

In the full `mithril` bundle, all the members of [`mithril/core`](../core/README.md#core-bundle) are re-exported as well as the following:

- `hydrate` from `mithril/dom`
- `request` from `mithril/request`
- `p` from `mithril/path`
- All exports from `mithril/router`
- All exports from `mithril/transition`
- All exports from `mithril/vnode-utils`

A UMD bundle of this will also be made available in `mithril/dist/full.dev.js`, minified in `mithril/dist/full.min.js`.

## Test bundle

The `mithril/test` bundle contains various helpful utilities for testing. Currently, it only re-exports `makeResolver` from `mithril/resolver`, but it may include others in the future like a query mechanism.

A UMD bundle of this will also be made available in `mithril/dist/test.dev.js`, minified in `mithril/dist/test.min.js`.
