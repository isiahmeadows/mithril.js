[*Up*](./README.md)

# Non-MVP Utilities

These are all various utilities I'm considering including in the redesign library later, but none of them are guaranteed and none of them will be included in the core bundle unless otherwise noted.

## Optimizer for the component DSL

The idea is to lower the component DSL into raw components, to compile away all the overhead. There will be complexity around custom hooks and similar, and I may have to create a synthetic runtime for cases where I can't statically inline everything (like with code splitting and such, if a function winds up separated from one of its call sites).

## Create custom element from component

Basically, handles everything you need for hooking a component up and tying it to a custom element. Handles revival, attributes, children, and events equally, but you have to specify which events could be listened for.

## Querying components' rendered trees

This is exposed under `mithril/query` and provides the ability to render a tree, update it with attributes, and query children with selectors.

This would mostly amount to bringing `mithril-query` into core, but just the core logic of it, not the integration with Should or Chai.

## Security verification using trusted strings

For things like `href: "javascript:..."`, those should require an opt-in. I'm blocked on work on trusted types, but I'd like an API that can integrate with whatever ends up used, whether it be [trusted types](https://github.com/WICG/trusted-types), [literals](https://github.com/mikewest/tc39-proposal-literals), or something else.

## Page transitions

Page transitions are one of those things that's never obvious to do. I'd like to explore to see what an adequate API would look like for helping people implement these.

## Event handler helpers

The DOM exposes a very low-level way of handling things, and it's not only easy to screw up at times, [it's also often hard to do *correctly*, even for the seemingly simplest of cases like a click](stdlib/route.md#links). So it may be worth providing some basic wrapper components for things like left clicks, drag-and-drop, long presses, among other things, stuff that's simple to the user, annoyingly complex for the developer.

[The React team is looking to do this themselves as well](https://gitter.im/mithriljs/mithril.js?at=5d363870d1cceb1a8da44199), and this is what prompted me to look into this in the first place, but in Mithril style, I'd like to keep it 1. simple, 2. easy, and 3. not in the core bundle. Thankfully, this redesign provides enough core primitives it's possible to [exploit this already for other things](stdlib/route.md#links), so it's entirely possible someone could come up with userland helpers first, and *then* them making their way into Mithril proper.

This was also in large part inspired by the React core team's work on sugared events for React, but with the mental model shifted to be a little more direct. Here's a few links for context:

- https://gitter.im/mithriljs/mithril.js?at=5d363870d1cceb1a8da44199
- https://twitter.com/isiahmeadows1/status/1158771013137707009
- https://gitter.im/mithriljs/mithril.js?at=5d49affb475c0a0feb0e4963

## An ESLint plugin with preset

I'd like to fork `eslint-plugin-react` as `@mithriljs/eslint-plugin-mithril`, and provide most of the same rules. Of course, we can't use it directly, and much of it applies neither to Mithril v2 *or* this redesign, so we'll have to alter a *lot* of them. For instance:

- [This rule](https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-array-index-key.md) would instead be checking if they're using the second argument to the `key` function.
- [This rule](https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/sort-comp.md) doesn't make much sense in a design that almost entirely *lacks* lifecycle methods to begin with. There's literally one: when the node is written to DOM. However, you *could* enforce a sort order with individual attributes and attributes relative to other nodes.

Also, rules based on [this accessibility plugin](https://github.com/evcohen/eslint-plugin-jsx-a11y) should be included in this plugin, with equivalents to their recommended rules + options included in our plugin's `recommended` list.

## A simple app/library generator

Many of us regular users have a set workflow and are just used to adding a bunch of crap to the `package.json` file and working accordingly. But setting up all that boilerplate gets tiring, and besides, we can provide a better workflow to get up to speed than writing to a bunch of files. We could instead provide a `@mithriljs/create-app` and `@mithriljs/create-lib` to generate those, and people would use `npm init @mithriljs/app`, `yarn create @mithriljs/app`, and similar to create it. We could also curate it very well and provide a lot of super convenient, almost magical functionality to help people get up to speed in no time at all.

It of course would walk people through the process, and set them up with safe defaults and a sane setup. It doesn't have to be too complicated to use, but we do want something that *empowers* users - it gets old having to rebuild apps all the time, and there are a lot of ways to get yourself stuck in a rut. Here's a few of them:

- Getting DOM mocks set up correctly is deceptively easy to screw up, even for us experienced people.
- Not configuring your linter properly is an easy way to run into a slew of gotchas - ESLint doesn't check JSX names for existence by default!
- Forgetting to re-run tests on your app while you're trying to fix something, only to realize you broke something else in the process, with no idea what.
- Forgetting to install a testing dependency after you got everything else set up.

This is what the generator is for.

As for what it would *do*: it would walk the user through a simple process with a couple choices for user preference, because this is Mithril and we know not all users have the same preferences. It would also install several useful modules to allow people to not have to fuss so much with dependency management and other concerns when it comes to dealing with assets and other things, and it'd just do the right thing in various circumstances like using `<script type="module">` + `<script nomodule>` with modern ES. Just in general getting out of the user's way while setting them up for success.

### Setup

The first thing it'd do is prompt for a few things and then set up the various dependencies.

- Name: any valid package string
- Testing: Mocha + Chai
    - This is chosen for familiarity, as both are already really popular, and [almost equally so](https://npm-stat.com/charts.html?package=mocha&package=chai&from=2018-09-14&to=2019-09-14).
    - ospec is deliberately not chosen because [it's getting about 200-300 downloads a week](https://npm-stat.com/charts.html?package=ospec&from=2018-09-14&to=2019-09-14) compared to Mithril's 15-30K. Not nearly popular enough to justify inclusion here. (Sorry, ospec fans.)
    - It would be set up with Karma with sensible OS-specific defaults for easy cross-browser testing as well as JSDOM for basic DOM tests. If a test requires a browser, define the file as `.browser.js` instead of `.js` (or `.browser.ts` instead of `.ts`, etc.).
    - There's currently no other options available, but I'd look forward to this changing.
- JS Language: "JavaScript", "JSX", "TypeScript", "TypeScript + JSX"
    - "JavaScript" sets up Rollup with CommonJS + Node support and Babel + `@babel/plugin-env` and calls it a day. It just uses standard JS up to the latest spec, with fallback for IE as necessary.
    - "JSX" also sets up `@mithriljs/jsx-babel`.
    - "TypeScript" also sets up `typescript` + `@types/mithril`, targeting the latest ES version to send through the standard JS pipeline.
    - "TypeScript + JSX" sets up modules required for both TypeScript and JSX, and configures TypeScript appropriately to preserve JSX so `@mithriljs/jsx-babel` can transpile it correctly.
    - "CoffeeScript" sets up modules required for both CoffeeScript and JSX, and sends it through the standard JSX pipeline. (CoffeeScript v2 supports JSX natively, preserving it in its output.) Supports both `.coffee` and `.litcoffee`.
    - In the future, other languages may be supported.
    - "JavaScript" will be our default here, as that's what most of us regular users use.
- CSS preprocessor: "CSS", "Less", "SCSS"
    - "CSS" sets up PostCSS with `postcss-preset-env` and [CSS Modules](https://github.com/css-modules/css-modules), complete with JS/TS integration as applicable, so you can use all the latest CSS stuff, automatically prefixed and polyfilled, with no issue. Implicitly starting the app's and library's stylesheet before any further CSS is included is [Normalize.css](https://github.com/necolas/normalize.css), a slightly opinionated CSS reset.
    - "Less" sets up Less and plugs the result into the same pipeline normal CSS is set up with, so you get to still have all the various polyfills and other benefits.
    - "SCSS" sets up Sass (via [the `sass` npm module](https://www.npmjs.com/package/sass)) using the SCSS syntax and likewise plugs the result into the same pipeline normal CSS is set up with, so you get to still have all the various polyfills and other benefits. You can still use `.scss` for the CSS-like syntax, `.sass` for the indented syntax - it just generates `.scss` files for you by default.
    - "Sass" works the same as "SCSS", just uses `.sass` by default instead and uses the original indented syntax.
    - In the future, other preprocessors may be supported.
    - "CSS" will be our default here for familiarity.
    - Sorry, [`bss`](https://github.com/porsager/bss#readme) fans - [it's less popular than ospec](https://npm-stat.com/charts.html?package=bss&from=2018-09-14&to=2019-09-14), and that's a really low bar to hit.
- These can be selected without prompt via `npm init @mithriljs/app -n name -c js -s css` and `npm init @mithriljs/lib -n name -c js -s css`:
    - `-n name` - Set package name to `name`
    - `-c js` - Select modern vanilla
    - `-c jsx` - Select JSX
    - `-c ts` - Select TypeScript
    - `-c tsx` - Select TypeScript + JSX (TSX)
    - `-s css` - Select CSS
    - `-s less` - Select Less
    - `-s scss` - Select Sass + SCSS syntax
    - `-s sass` - Select Sass + indented syntax

Then, it'd set up a Git repo at the specified location and install the following packages:

- `mithril`
- `@mithriljs/eslint-config-mithril`
- `@mithriljs/scripts` or similar, housing all the logic for `@mithriljs/create-{app,lib}`, the dev server, the build system, and the test framework
    - The flattened dependency structure will allow editors to do the right thing.
    - This will also implement the glue code to resolve non-executables as assets, although this can be toggled per-library.

In `package.json` it'd save the type, choice of testing framework, and choice of code style in `"@mithriljs/create"`. It'd also install a few scripts:

- `npm start`: Run the app in development mode, rebuilding on each change with `process.env.NODE_ENV = "development"`. Set the port via `-p PORT` or `--port=PORT`. This works in the background.
- `npm test`: Run the tests, watching and re-running them on each change.
- `npm test --once`: Run the tests once
- `npm run build`: Build the app. Sets `process.env.NODE_ENV = "production"` to trigger various apps to optimize their bundles.
- `npm run eject`: Eject the app by installing all the required dependencies such that you no longer need the usual scripts. This is only really necessary for fairly advanced use cases like multi-page apps and libraries with multiple modules as part of its public API. Build scripts are saved in `tasks/`.

The end structure would end up being generally all around useful and although it'll be necessarily opinionated in project structure, it'll be so you don't have to think much about configuration just to get started. The two boilerplates create similar structures, but they're subtly different:

- `@mithriljs/create-app`:
    - `dist/` - Where your source code is compiled to.
        - `-/` - Contains all the renamed and dynamically generated files
            - `${id}.mjs` - Minified ESM dynamically loaded chunks
            - `${id}.mjs.map` - Generated source map for the ESM dynamically loaded chunks
            - `${id}.js` - Minified fallback JS dynamically loaded chunks
            - `${id}.js.map` - Generated source map for the fallback JS dynamically loaded chunks
            - `${id}.css` - Minified CSS dynamically loaded chunks
            - `${id}.css.map` - Generated source map for the CSS dynamically loaded chunks
            - `${id}.ext` - Imported assets in `src/` other than code and styles. This includes assets from dependencies. (Uses a similar process as [`rollup-plugin-rebase`](https://github.com/sebastian-software/rollup-plugin-rebase), but requires slightly different processing.)
            - Each file name iterates from 0 using a base 64 numeral. The digits are represented via `['0'...'9', 'A'...'Z', 'a'...'z', '+', '-']`.
            - This includes all script and CSS entry points, including the main ones.
        - `index.html` - The compiled, minified HTML file
        - All the stuff from `public/`
        - The dynamically loaded chunks also include the common chunk, for ease of use.
    - `node_modules/` - Where your dependencies live, including `@mithriljs/scripts`.
    - `public/` - Public files
        - `favicon.ico` - A generic favicon
        - `index.html` - Your root HTML file, where `<!--% entry %-->` is substituted for your actual entry scripts and styles.
        - Only stuff in this folder can be referenced globally.
    - `src/` - Your source code, including both code and styles
        - `index.{css,less,scss,sass}` - Your style entry point
        - `index.{mjs,jsx,ts,tsx}` - Your script entry point
        - `App.{css,less,scss,sass}` - Your main component
        - `App.{mjs,jsx,ts,tsx}` - Your main component's styles
    - `test/` - Your tests
        - `App.{mjs,jsx,ts,tsx}` - Your main component's test file
    - `.eslintrc.js` - Contains a minimal config delegating to `@mithriljs/eslint-preset-create`.
    - `config.js` - Lets you customize the config for Babel, PostCSS, and such, so you don't have to unmount just to tweak basic settings. This is loaded as a CommonJS module.
    - `package.json` - Contains the basic info on

- `@mithriljs/create-lib`:
    - `dist/` - Where your source code is compiled to.
        - `umd.js` - The unminified UMD bundle, for consumers not using `@mithriljs/create-{app,lib}`, with CSS inlined and added on load
        - `umd.js.map` - The generated source map for the UMD bundle
        - `esm.mjs` - The unminified ESM bundle, for consumers not using `@mithriljs/create-{app,lib}`, with CSS inlined and added on load
        - `esm.mjs.map` - The generated source map for the ESM bundle
        - `create-lib.mjs` - The unminified library bundle targeting `@mithriljs/create-app`, with asset dependency links rewritten but other external dependencies intact.
        - `create-lib.mjs.map` - The generated source map for the library bundle
        - `assets/` - Imported assets in `src/` other than code. This includes the CSS and the assets the CSS depends on.
            - `${id}.css` - Minified CSS dynamically loaded chunks
            - `${id}.css.map` - Generated source map for the CSS dynamically loaded chunks
            - `${id}.ext` - Imported assets in `src/` other than code and styles. This includes assets from dependencies. (Uses a similar process as [`rollup-plugin-rebase`](https://github.com/sebastian-software/rollup-plugin-rebase), but requires slightly different processing.)
    - `node_modules/` - Where your dependencies live, including the scripts for `@mithriljs/create-lib`.
    - `src/` - Your source code, including both code, styles, and possible images and similar.
        - `index.{css,less,scss,sass}` - Your style entry point
        - `index.{mjs,jsx,ts,tsx}` - Your script entry point
        - `App.{css,less,scss,sass}` - Your main component
        - `App.{mjs,jsx,ts,tsx}` - Your main component's styles
        - Stylesheets can be deleted if necessary
    - `test/` - Your tests
        - `App.{mjs,jsx,ts,tsx}` - Your main component's test file
    - `.eslintrc.js` - Contains a minimal config delegating to `@mithriljs/eslint-preset-create`.
    - `config.js` - Lets you customize the config for Babel, PostCSS, and such, so you don't have to unmount just to tweak basic settings. This is loaded as a CommonJS module.
    - `package.json` - Contains the basic info on

During build, a few things will be applied so they have always-optimized builds.

- Two bundles will be generated on build, a `<script type="module">` variant and a `<script nomodule>` variant.
- Babel and TypeScript helpers will always be loaded from a shared helper module.
- The production builds of those also use `mopt` and `html-minifier` to optimize the heck out of them.

### Future nice-to-haves

- I'd like to see if I can get multi-page apps supported, complete with easy isomorphic rendering and minification. It'll use Mithril's static renderer in Node to run it and it'll use Node's `--experimental-modules`. This is pending stabilization of [Node's ESM API](https://nodejs.org/api/esm.html), and I also need to write a custom loader for it to do proper resolution and cache invalidation. (It'll require native code until [this proposal](https://github.com/tc39/proposal-weakrefs) gets merged, sadly, because I'll need to know *when* it's collected so I can properly clear the cache.)
    - Short-term, while I wait on this, I could just use worker threads for this, with each page run with `esm` in its own worker thread.
