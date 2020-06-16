[*Up*](./README.md)

# Legacy features

There's a few v1/v2 features that have some significant use, but I don't want to keep them in core. I will continue to support some of them due to popularity, but they won't all be in the same place they once were.

## Mithril v1/v2 streams

This will be maintained in its own repo and published as `mithril-stream`, evolved separately from Mithril itself. As many users have grown to like them, I'll keep it laying around and may even add a few utilities to make it easier to consume within the component DSL, but it's not going to remain a first-class part of Mithril. (I see too many people abusing them in ways that leak memory.)

> I currently have mithril-stream deprecated, but this will change when the redesign lands as the component DSL will resolve most the usability issues that people use streams to work around. Also, the redesign offers an opportunity to evolve it independently in ways that would be just generally useful.

## ospec

This will be maintained in its own repo and publised on npm as `ospec` as it is today. It will *not* be shipped in the core distribution itself, as is also the case today. It'll still be in the main repo, but Mithril core's tests won't use ospec - only the legacy modules will.

> I made this transition during v2, and it's runtime-deprecated with removal planned for v3. This change will happen whether this redesign lands or not.

## Mithril's DOM mocks

Those will be removed from the distribution as they were never intended to be that way in the first place. The new tests will use the DOM directly as necessary, using JSDOM in Node where applicable.

> I plan to remove this in a patch release, as this particular functionality, alongside the bundler, was never documented and in general was never really designed to be robust enough to satisfy most users' needs, especially with the mocks. (I couldn't tell you how many times I had to update the mocks to accurately implement certain spec details.)
