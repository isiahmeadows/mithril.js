# Mithril Redesign

## Status

This is a major work in progress, and is very much so a pre-proposal that's still being honed and improved upon. Please don't assume *anything* here is actually going to make it into the next version. Also, don't assume it's targeting version 3 either - there are no active plans for any of this to actively target version 3 specifically. (It might, but there is no guarantee.)

## Design

See [this directory](https://github.com/isiahmeadows/mithril.js/tree/redesign/design) for more details.

## Feedback?

If you have *any* feedback, questions, or concerns, please do feel free to [file an issue](https://github.com/isiahmeadows/mithril.js/issues/new).

## Contributing

I separated this out into a monorepo with three packages:

- `packages/mithril` - This is the main package, with all the interesting stuff in it.
- `packages/mithril-stream` - This holds the old stream utility.
- `packages/ospec` - This holds the `ospec` test runner.

Other popular community packages like `mithril-infinite`, `mithril-query`, and `mopt` (previously: `mithril-objectify`) could eventually be brought into the repo, but I plan to keep it to this first. I could later also add a `babel-plugin-mithril` that better optimizes JSX and `m()` calls and `eslint-plugin-mithril`\* to help with ensuring best practices. This does have some precedent - [React did it with React ART](https://github.com/facebook/react/tree/master/packages), [Babel did it with `@babel/preset-react` and `@babel/preset-env`](https://github.com/babel/babel/tree/master/packages), and [Karma pulled nearly all the most commonly-used plugins, launchers, and reporters into its organization](https://github.com/karma-runner) (it doesn't use a monorepo).

\* Such a package [*does* currently exist](https://github.com/dhinesh03/eslint-plugin-mithril), but
