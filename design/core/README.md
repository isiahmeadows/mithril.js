[*Up*](../README.md)

# Core

Core would change considerably, but this is to simplify the API and better accommodate components.

- [Streams](streams.md)
- [Hyperscript API](hyperscript.md)
- [JSX API](jsx.md)
- [DOM renderer API](dom.md)
- [Streams API](streams.md)
- [Stream utilities](stream-utils.md)
- [Events API](events.md)

## Goals

- Libraries should be largely independent of where it gets its Mithril state. This is why `render` and `context` are passed as parameters rather than being global.
	- This means code can be isomorphic with almost no effort, even if they involve a *lot* of complicated state initialization.
	- It would also let me experiment with making a renderer that operates entirely off the main thread, keeping that exclusively for DOM computation and event management.
- It should be as concise as pragmatically possible, yet still remain actual JS. This guided my decision to make this heavily functional.
- It should be fast - not for simple hand-tuned code, but for the code you'd write normally anyways.
- The framework as a whole should be easily tree-shakeable.

## Type definitions

Type definitions would be moved into core, to live alongside everything else. I specifically *want* TypeScript to be supported as a first-class language, even if they don't use JSX.

## Core bundle

The core bundle, `mithril/core` re-exports the following:

- All exports from `mithril/hyperscript`
- All exports from `mithril/stream`
- `render` and `abortable` from `mithril/dom`, but not `hydrate`.

A UMD bundle of this will also be made available in `mithril/dist/core.dev.js`, minified in `mithril/dist/core.min.js`. In addition, a UMD bundle of `mithril/stream` itself will be made available in `mithril/dist/stream.dev.js`, minified in `mithril/dist/stream.min.js`.
