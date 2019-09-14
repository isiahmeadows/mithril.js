[*Up*](../../README.md)

# ThreaditJS Demo

This is a set of [ThreaditJS](http://threaditjs.com/) implementations to show how the redesign compares to Mithril v2, traditional React, and React with their experimental Hooks API. It implements effectively identical functionality, but they come out with dramatically different source features and sizes, particularly the redesign compared to the rest.

- [Mithril redesign (vanilla)](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/mithril-redesign-vanilla)
- [Mithril redesign (JSX)](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/mithril-redesign-jsx)
- [Mithril v1/v2 (vanilla)](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/mithril-v2-vanilla)
- [Mithril v1/v2 (JSX)](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/mithril-v2-jsx)
- [React with classes](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/react), using [the class fields proposal](https://github.com/tc39/proposal-class-fields) commonly used in that community for the JSX variant. (Reduces some of the class setup boilerplate.)
- [React with hooks](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/react-hooks)
- [Vue](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/vue), with all the templates specified in the main JS source file for consistency with the rest. (Idiomatically, it'd be in the HTML, but it'd amount to roughly the same lines of code either way.)

### Source format

Each source file contains a Rollup config script used to set it up, an `index.html` entry point using the generated bundle, and the `/app.mjs` file used to initialize it. In addition, all four variants feature vanilla JS and JSX implementations for an even comparison.

They are coded to generally share the same architecture, to keep it as much an apples-to-apples comparison as possible.

### Source sizes

These only include the main source files in each variant. The totals exclude the usual whitespace-only lines, comment-only lines, and empty lines, but they *do* include the full source code minus configuration and HTML entry point. This even includes the API wrappers, which amounts to about 20-30 lines across each.

| Library                    | SLoC | Total |
|:-------------------------- |:----:|:-----:|
| Mithril redesign (vanilla) | 137  |  162  |
| Mithril redesign (JSX)     | 147  |  173  |
| Mithril v1/v2 (vanilla)    | 171  |  196  |
| Mithril v1/v2 (JSX)        | 191  |  215  |
| React with classes         | 233  |  268  |
| React + hooks              | 202  |  231  |
| Vue                        | 195  |  232  |

> SLoC = Significant Lines of Code, if you're not familiar with the acronym. This excludes comments and whitespace-only lines, but includes all others.*

If you look at those SLoC numbers, one certainly sticks out to me: how *small* the Mithril redesign code is, despite it feeling a little boilerplatey and verbose in spots. It's substantially smaller than any of its competitors in both variants, and is still the smallest with the usually overly spacious idiomatic JSX by similar margins:

- Vanilla:
    - ~20% fewer lines than Mithril v1/v2.
    - ~30% fewer lines than Vue.

- JSX:
    - ~23% fewer lines than Mithril v1/v2.
    - ~37% fewer lines than React with classes.
    - ~27% fewer lines than React + hooks.

> If you'd like to verify these numbers, just do 1 - (size of redesign's SLoC) / (size of other's SLoC). These figures are all rounded to the nearest percent and exclude comment-only JSX lines like `{/* comment */}`.

Being literally 2/3 the size of vanilla React for functionally identical code is impressive in of itself (imagine how it would be compared with React Redux), but being as much as 20% smaller than even Mithril v2, which itself strips nearly all the React boilerplate away, is itself even more impressive, especially considering the redesign code here in this demo is written a little bit spaciously.

### Stability

The redesign didn't just stop at being smaller - it also kept me from even having to worry about a whole class of bugs in the process, namely not updating properties and state when I need to:

1. Cancelling requests on sudden, quick route change comes practically for free, so coding support for that was as simple as loading a simple built-in helper and passing that to the request. I had to explicitly code this for the other apps, but the `ctrl.signal()` built-in method made this a small 4-line change to correct for in the redesign variant.

    ```diff
     function Async(ctrl, attrs) {
    -    const current = ctrl.await(() => {
    -        attrs.load().then((value) => attrs.on.load(value))
    +    const current = ctrl.await((signal) => {
    +        attrs.load(signal).then((value) => attrs.on.load(value))
         })

         return (nextAttrs) => {
             attrs = nextAttrs
             switch (current.state) {
                 case "pending": return m("h2", "Loading")
                 case "ready": return [].concat(nextAttrs.view())
                 default:
                     return current.value.status === 404
                         ? m("h2", "Not found! Don't try refreshing!")
                         : m("h2", "Error! Try refreshing.")
             }
         }
     }

     function Home() {
         let threads

         return () => [
             m(Header),
             m("div.main", m(Async, {
    -            load: () => api.home(),
    +            load: (signal) => api.home({signal}),
                 on: {load: (response) => threads = response.data},
                 view: () => [
                     m.each(threads, "id", (thread) => m(ThreadPreview, {thread})),
                     m(NewThread, {on: {save(thread) { threads.push(thread) }}}),
                 ],
             })
         ]
     }

     function Thread(ctrl) {
         T.time("Thread render")
         ctrl.afterCommit(() => T.timeEnd("Thread render"))
         let node

         return ({id}) => [
             m(Header),
             m("div.main", m.link(id, m(Async, {
    -            load: () => api.thread(id),
    +            load: (signal) => api.thread(id, {signal}),
                 on: {load(root) {
                     node = root
                     document.title = "ThreaditJS: Mithril | " +
                         T.trimTitle(root.text)
                 }},
                 view: () => m(ThreadNode, {node}),
             }))
         ]
     }
    ```

1. Suppose you autolink links to different threads and convert them into just simple routing links. Assuming the router doesn't replace the view entirely, this would let you switch the thread ID directly during diffing, so that case needs handled. In the redesign variant, I only needed to make sure the result was wrapped in an `m.link(id, ...)` to ensure the link was reinitialized. The only two easy mistakes I could've made were either forgetting to deduplicate IDs or forgetting to hook up the request for cancellation, but both of these are only minor, easily-fixed perf bugs, not major functional bugs you're up at night trying to fix. It wasn't until after I started typing this up initially and when studying how the redesign variant worked that I realized I accidentally did the right thing there. The other three are a bit of a different story, and all three of them had to be fixed to update after receiving a new, different ID:
    - The React Hooks variant required me add a new parameter to account for this, equating to a small 4 line change. Note that following the ["rules of Hooks"](https://reactjs.org/docs/hooks-rules.html) wouldn't have gotten me there! (In fact, the recommended ESLint `react-hooks` plugin fix was actually *wrong* in that it wanted me to add the callback itself as a dependency when in reality it's part of the effect body.)
    - The Mithril v2 variant would've never triggered the buggy code path, since Mithril replaces the full tree when changing routes and either the old or new route is a component. If I later decided to abstract the page into a generic layout rendered via a route resolver, I would've quickly received a bug report then, because nobody would ever reasonably suspect *that* would unmask any new bugs.
    - The React variant was similar, but the bug would *not* have been masked initially. React Router never replaces its components directly, so this would've quickly shown up in a bug report later - nobody would normally think to double-check that kind of thing. I would *not* have likely noticed this when initially developing the page, though!

In general, *because* the view is always redrawing with the most current attributes, it's harder to forget to update state and react accordingly. I have to consciously choose *not* to update something in general.

While refactoring the examples from React JSX to all four variants having JSX + vanilla variants, I noticed that the `Home` and `Thread` routes' pages shared a *lot* of code, so I decided to replace my previous `Async` component/`async` stream with a `Layout` component that also wrapped the promise from loading the result.

- For the redesign variant, this was a magically simple code change within `async` - I just renamed it to `Layout`, factored the old result to an internal function, and added a new returned function that called into that for the newly wrapped children. I then updated the callees accordingly. Overall, it was quick and painless.
- For React Hooks, it was fairly simple: wrap the returned node inside the desired DOM.
- For React with the usual classes, this ended up a very similar refactor to my redesign, just significantly more verbose as its syntax is more verbose.
- For Mithril v1/v2, it was a minor nuisance because I had to create an inner function, copy everything over, and recast the `view`. It was slightly more work, even though it was more or less the same refactor.

Here's what the diffs for each of those in the vanilla version:

- Mithril redesign:

    ```diff
    -function Async(attrs) {
    +function Layout(attrs) {
         const current = ctrl.await((signal) =>
             attrs.load(signal).then((value) => attrs.on.load(value))
         )

    -    return (nextAttrs) => {
    +    function getChildren(nextAttrs) {
             attrs = nextAttrs
             switch (current.state) {
                 case "pending": return m("h2", "Loading")
                 case "ready": return [].concat(nextAttrs.view())
                 default:
                     return current.value.status === 404
                         ? m("h2", "Not found! Don't try refreshing!")
                         : m("h2", "Error! Try refreshing.")
             }
         }
    +
    +    return (nextAttrs) => [
    +        m(Header),
    +        m("div.main", getChildren(nextAttrs))
    +    ]
     }
    ```

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

    -    switch (state) {
    -        case "pending": return <h2>Loading</h2>
    -        case "ready": return children
    -        case "missing": return <h2>Not found! Don&apos;t try refreshing!</h2>
    -        case "error": return <h2>Error! Try refreshing.</h2>
    -    }
    +    let view
    +
    +    switch (state) {
    +        case "pending": view = <h2>Loading</h2>; break
    +        case "ready": view = children; break
    +        case "missing": view = <h2>Not found! Don&apos;t try refreshing!</h2>; break
    +        case "error": view = <h2>Error! Try refreshing.</h2>; break
    +    }
    +
    +    return <>
    +        <Header />
    +        <div className="main">{view}</div>
    +    </>
     }
    ```

    You'd expect React Hooks to be the simpler one here, but you end up having to alter not one thing, but a few things, and it ends up all around ugly. You have to add a new variable, change all the `return`s to `view = ...` where `view` is that variable, and then you have to write the new `return`. All to just wrap a simple result, thanks to JS being expression-oriented.

- Mithril v1/v2:

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
    +            case "loading": return m("h2", "Loading")
    +            case "notFound": return m("h2", "Not found! Don't try refreshing!")
    +            case "error": return m("h2", "Error! Try refreshing.")
    +            default: return attrs.view()
    +        }
    +    }
    +
         return {
             onremove: () => controller.abort(),

             view: (vnode) => {
                 attrs = vnode.attrs
    -            switch (state) {
    -                case "loading": return m("h2", "Loading")
    -                case "notFound": return m("h2", "Not found! Don't try refreshing!")
    -                case "error": return m("h2", "Error! Try refreshing.")
    -                default: return attrs.view()
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

As you can see, it's a little easier to refactor safely with this redesign.
