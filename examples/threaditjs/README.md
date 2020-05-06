[*Up*](../../README.md)

# ThreaditJS Demo

This is a set of [ThreaditJS](http://threaditjs.com/) implementations to show how the redesign compares to Mithril v2, traditional React, and React with their experimental Hooks API. It implements effectively identical functionality, but they come out with dramatically different source features and sizes, particularly the redesign compared to the rest.

- [Mithril redesign (vanilla)](https://github.com/isiahmeadows/mithril.js/tree/redesign-redux/examples/threaditjs/mithril-redesign-vanilla)
- [Mithril redesign (JSX)](https://github.com/isiahmeadows/mithril.js/tree/redesign-redux/examples/threaditjs/mithril-redesign-jsx)
- [Mithril v2 (vanilla)](https://github.com/isiahmeadows/mithril.js/tree/redesign-redux/examples/threaditjs/mithril-v2-vanilla)
- [Mithril v2 (JSX)](https://github.com/isiahmeadows/mithril.js/tree/redesign-redux/examples/threaditjs/mithril-v2-jsx)
- [React with classes (JSX)](https://github.com/isiahmeadows/mithril.js/tree/redesign-redux/examples/threaditjs/react-jsx), using [the class fields proposal](https://github.com/tc39/proposal-class-fields) commonly used in that community for the JSX variant. (Reduces some of the class setup boilerplate.)
- [React with hooks (JSX)](https://github.com/isiahmeadows/mithril.js/tree/redesign-redux/examples/threaditjs/react-hooks-jsx)
- [Vue](https://github.com/isiahmeadows/mithril.js/tree/redesign-redux/examples/threaditjs/vue), with all the templates specified in the main JS source file for consistency with the rest. (Idiomatically, it'd be in the HTML, but it'd amount to roughly the same lines of code either way.)

### Source format

Each source file contains a Rollup config script used to set it up, an `index.html` entry point using the generated bundle, and the `/app.mjs` file used to initialize it. In addition, all four variants feature vanilla JS and JSX implementations for an even comparison.

They are coded to generally share the same architecture, to keep it as much an apples-to-apples comparison as possible.

### Source sizes

These only include the main source files in each variant. The totals exclude the usual whitespace-only lines, comment-only lines, and empty lines, but they *do* include the full source code minus configuration and HTML entry point. This even includes the API wrappers, which amounts to about 20-30 lines across each, as well as all the import boilerplate for each.

| Library                            | SLoC | Total |
|:---------------------------------- |:----:|:-----:|
| Mithril redesign library (vanilla) | 153  |  173  |
| Mithril redesign library (JSX)     | 163  |  185  |
| Mithril redesign DSL (vanilla)     | 140  |  160  |
| Mithril redesign DSL (JSX)         | 153  |  174  |
| Mithril v2 (vanilla)               | 182  |  206  |
| Mithril v2 (JSX)                   | 202  |  226  |
| React with classes (JSX)           | 250  |  282  |
| React + hooks (JSX)                | 215  |  241  |
| Vue (template DSL)                 | 230  |  264  |
| Svelte (template DSL)              | 159  |  188  |

> SLoC = Significant Lines of Code, if you're not familiar with the acronym. This excludes comments and whitespace-only lines, but includes all others.*

If you look at those SLoC numbers, one certainly sticks out to me: how *small* the Mithril redesign source code is, despite it feeling a little boilerplatey and verbose in spots. It's substantially smaller than any of its competitors in both variants, and is still the smallest with the usually overly spacious idiomatic JSX by similar margins:

|  Vanilla   |    Library   |      DSL     |
|:---------- |:------------:|:------------:|
| Mithril v2 | ~16% smaller | ~23% smaller |
| Vue        | ~33% smaller | ~39% smaller |
| Svelte     | ~4% smaller  | ~12% smaller  |

|       JSX       |    Library   |      DSL     |
|:--------------- |:------------:|:------------:|
| Mithril v2      | ~19% smaller | ~25% smaller |
| React + classes | ~35% smaller | ~39% smaller |
| React + hooks   | ~24% smaller | ~29% smaller |

> If you'd like to verify these numbers, just do 1 - (size of redesign's SLoC) / (size of other's SLoC). These figures are all rounded to the nearest percent and exclude comment-only JSX lines like `{/* comment */}`.

Being literally about 2/3 to 3/4 the size of React for functionally identical code is impressive in of itself (imagine how it would be compared with React Redux), but being as much as 15-20% smaller than even Mithril v2, which itself strips nearly all the React boilerplate away, is itself even more impressive, especially considering the redesign code here in this demo is written a little bit spaciously in spots.

Svelte has v2 beat by stripping *even more* of that boilerplate away by making all updates implicit, and source code conciseness is often touted as one of its advantages. My redesign still beats that by significant margin, and it's still easier to read in much of it due to a much lower token count and much less grammatical redundancy. (Some of the lines in the Svelte code read almost as line noise due to a lot of punctuation tokens smashed together, especially with event handlers, where Mithril lacks it entirely.) It's also considerably less magical.

### Stability

The redesign didn't just stop at being smaller - it also kept me from even having to worry about a whole class of bugs in the process, like not updating properties and state when I need to and like actually *updating* state when I need to.

> Note: the example diffs here ignore whitespace-only changes, and this includes indentation-only changes. They're all also hand-written, not machine-generated.

1. Cancelling requests on sudden, quick route change comes practically for free, so coding support for that was as simple as loading a simple built-in helper and passing that to the request. I had to explicitly code this for the other apps, but the `ctrl.signal()` built-in method made this a small 3-line diff to correct for in the redesign variant.

    ```diff
     function Async({load, view}) {
         return m(Use, {init: load, view: (current) => current.match({
             pending: () => m("h2", "Loading"),
             complete: v => [view(v)],
             error: e => e.status === 404
                 ? m("h2", "Not found! Don't try refreshing!")
                 : m("h2", "Error! Try refreshing."),
         }))
     }

     function Home() {
         return () => [
             m(Header),
             m("div.main", m(Async, {
    -            load: async () => (await api.home()).data,
    +            load: async (signal) => (await api.home({signal})).data,
                 view: threads => [
                     m.each(threads, "id", thread => m(ThreadPreview, {thread})),
                     m(NewThread, {on: {save(thread) { threads.push(thread) }}}),
                 ],
             })
         ]
     }

     function Thread({id}, info) {
         T.time("Thread render")

         return [
             info.isInitial() && m.capture(() => T.timeEnd("Thread render")),
             m(Header),
             m("div.main", m.link(id, m(Async, {
    -            load: async () => {
    +            load: async (signal) => {
    -                const node = (await api.thread(id)).root
    +                const node = (await api.thread(id, {signal})).root
                     document.title = `ThreaditJS: Mithril | ${T.trimTitle(node.text)}`
                     return node
                 }},
                 view: () => m(ThreadNode, {node}),
             }))
         ]
     }
    ```

    I even accidentally got the `Async` component right - I just needed to migrate the callers of it.

1. Suppose you autolink links to different threads and convert them into just simple routing links. Assuming the router doesn't replace the view entirely, this would let you switch the thread ID directly during diffing, so that case needs handled. In the redesign variant, I only needed to make sure the result was wrapped in an `m.link(id, ...)` to ensure the link was reinitialized, and in the DSL variant, wrapping the `use(...)` in a `guard(hasChanged(id), () => use(...))` made it such that I didn't even need to link an ID. The only mistake I could've made would've been forgetting to hook up the request for cancellation, but that's a minor perf bug (extra network spam), not a major functional bug keeping you up at night. It wasn't until after I started typing this up initially and when studying how the redesign variant worked that I realized I accidentally did the right thing there. The other three are a bit of a different story, and all three of them had to be fixed to update after receiving a new, different ID:
    - The React Hooks variant required me add a new parameter to account for this, equating to a small 4 line change. Note that following the ["rules of Hooks"](https://reactjs.org/docs/hooks-rules.html) wouldn't have gotten me there! (In fact, the fix recommended by `eslint-plugin-react` plugin was actually *wrong* in that it wanted me to add the callback itself as a dependency when in reality the dependency is part of the effect body.)
    - The Mithril v2 variant would've never triggered the buggy code path, since Mithril replaces the full tree when changing routes and either the old or new route is a component. If I later decided to abstract the page into a generic layout rendered via a route resolver, I would've quickly received a bug report then unless I had proper E2E coverage *and* ran the full test suite, because nobody would ever reasonably suspect *that* would unmask any new bugs.
    - The React variant was similar, but the bug would *not* have been masked initially. React Router never replaces its components directly, so this would've quickly shown up in a bug report later - nobody would normally think to double-check that kind of thing. I would *not* have likely noticed this when initially developing the page, though!

In general, *because* the view is always redrawing with the most current attributes, it's harder to forget to update state and react accordingly. I have to consciously choose *not* to update something in general.

While refactoring the examples from React JSX to all four variants having JSX + vanilla variants, I noticed that the `Home` and `Thread` routes' pages shared a *lot* of code, so I decided to replace my previous `Async` component/`async` stream with a `Layout` component that also wrapped the promise from loading the result.

- For the redesign variant, this was a magically simple code change within `async` - I just renamed it to `Layout`, factored the old result to an internal function, and added a new returned function that called into that for the newly wrapped children. I then updated the callees accordingly. Overall, it was quick and painless.
- For React Hooks, it was fairly simple: wrap the returned node inside the desired DOM.
- For React with the usual classes, this ended up a very similar refactor to my redesign, just significantly more verbose as its syntax is more verbose.
- For Mithril v2, it was a minor nuisance because I had to create an inner function, copy everything over, and recast the `view`. It was slightly more work, even though it was more or less the same refactor.

Here's what the diffs for each of those in the vanilla version:

- Mithril redesign (library variant):

    ```diff
    -function Async({attrs, view}) {
    +function Layout({attrs, view}) {
    +    return [
    +        m(Header),
    -    return m(Use, {init: load, view: (current) => current.match({
    +        m("div.main", m(Use, {init: load, view: (current) => current.match({
                 pending: () => m("h2", "Loading")
                 complete: v => [view(v)]
                 error: e => e.status === 404
                     ? m("h2", "Not found! Don't try refreshing!")
                     : m("h2", "Error! Try refreshing."),
    -    })})
    +        })})),
    +    ]
     }
    ```

    Most of this diff is just changing indentation, and it was pretty straightforward.

- Mithril redesign (DSL variant):

    ```diff
    -const Async = component(({attrs, view}) {
    +const Layout = component(({attrs, view}) {
         const info = useInfo()
         const result = use((signal) => load(signal))

    +    return [
    +        m(Header),
    -    return result.match({
    +        m("div.main", result.match({
                 pending: () => m("h2", "Loading")
                 complete: v => [view(v)]
                 error: e => e.status === 404
                     ? m("h2", "Not found! Don't try refreshing!")
                     : m("h2", "Error! Try refreshing."),
    -    })
    +        })),
    +    ]
     })
    ```

    Like before, most of this diff is just changing indentation, and it was just as straightforward.

- React Hooks:

    ```diff
    -function Async({load, onLoad, children}) {
    +function Layout({load, onLoad, children}) {
         const [view, setView] = useState(<h2>Loading</h2>)

         useEffect(() => {
             const controller = new AbortController()
             new Promise((resolve) => resolve(load(controller.signal)))
                 .then((response) => {
                     setView(children)
                     onLoad(response)
                 }, (e) => {
                     setView(e.status === 404
                         ? <h2>Not found! Don&apos;t try refreshing!</h2>
                         : <h2>Error! Try refreshing.</h2>)
                 })
             return () => controller.abort()
         }, []) // eslint-disable-line react-hooks/exhaustive-deps

    +    let view
    +
         switch (state) {
    -    case "pending": return <h2>Loading</h2>
    -    case "ready": return children
    -    case "missing": return <h2>Not found! Don&apos;t try refreshing!</h2>
    -    case "error": return <h2>Error! Try refreshing.</h2>
    +    case "pending": view = <h2>Loading</h2>; break
    +    case "ready": view = children; break
    +    case "missing": view = <h2>Not found! Don&apos;t try refreshing!</h2>; break
    +    case "error": view = <h2>Error! Try refreshing.</h2>; break
         }
    +
    +    return <>
    +        <Header />
    +        <div className="main">{view}</div>
    +    </>
     }
    ```

    You'd expect React Hooks to be the simpler one here, but you end up having to alter not one thing, but a few things, and it ends up all around ugly. You have to add a new variable, change all the `return`s to `view = ...` where `view` is that variable, and then you have to write the new `return`. All to just wrap a simple result, thanks to JS being expression-oriented.

- Mithril v2:

    ```diff
    -function Async({attrs}) {
    +function Layout({attrs}) {
         const controller = new AbortController()
         let state = "loading"

         attrs.load(controller.signal)
             .then((response) => {
                 state = "ready"
                 attrs.onload(response)
             }, (e) => {
                 state = e.status === 404 ? "notFound" : "error"
             })
             .finally(m.redraw)

    +    function pageView() {
    +        switch (state) {
    +        case "loading": return m("h2", "Loading")
    +        case "notFound": return m("h2", "Not found! Don't try refreshing!")
    +        case "error": return m("h2", "Error! Try refreshing.")
    +        default: return attrs.view()
    +        }
    +    }
    +
         return {
             onremove: () => controller.abort(),

             view: (vnode) => {
                 attrs = vnode.attrs
    -            switch (state) {
    -            case "loading": return m("h2", "Loading")
    -            case "notFound": return m("h2", "Not found! Don't try refreshing!")
    -            case "error": return m("h2", "Error! Try refreshing.")
    -            default: return attrs.view()
    -            }
    +            return [
    +                m(Header),
    +                m(".main", pageView()),
    +            ]
             },
         }
     }
    ```

    Yep, it felt almost like small-scale [shotgun surgery](https://en.wikipedia.org/wiki/Shotgun_surgery) here.

- React class:

    ```diff
    -class Async extends React.Component {
    +class Layout extends React.Component {
         constructor(...args) {
             super(...args)
             this.state = {state: "loading"}
             this.controller = new AbortController()

             this.props.load(this.controller.signal).then((response) => {
                 document.title = "ThreaditJS: React | Home"
                 this.setState({state: "ready"})
                 this.props.onLoad(response)
             }, (e) => {
                 this.setState({
                     state: e.status === 404 ? "notFound" : "error",
                 })
             })
         }

         componentWillUnmount() {
             this.controller.abort()
         }

    -    render() {
    +    renderPage() {
             switch (this.state.state) {
             case "loading":
                 return <h2>Loading</h2>

             case "notFound":
                 return <h2>Not found! Don&apos;t try refreshing!</h2>

             case "error":
                 return <h2>Error! Try refreshing.</h2>

             default:
                 return this.props.children
             }
         }
    +
    +    render() {
    +        return <>
    +            <Header />
    +            <div className="main">{this.renderPage()}</div>
    +        </>
    +    }
     }
    ```

As you can see, it's a little easier to refactor safely with this redesign, and it's harder to get into situations with bugs in the first place.
