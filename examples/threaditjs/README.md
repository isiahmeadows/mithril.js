[*Up*](../../README.md)

# ThreaditJS Demo

This is a set of [ThreaditJS](http://threaditjs.com/) implementations to show how the redesign compares to Mithril v2, traditional React, and React with their experimental Hooks API. It implements effectively identical functionality, but they come out with dramatically different source features and sizes, particularly the redesign compared to the rest.

- [Mithril redesign](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/mithril-redesign)
- [Mithril v1/v2](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/mithril-v2)
- [React](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/react)
- [React + experimental Hooks API](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/react-hooks)

### Source format

Each source file contains a Rollup config script used to set it up, an `index.html` entry point using the generated bundle, and the `/app.mjs` file used to initialize it. In addition, all four variants feature vanilla JS and JSX implementations for an even comparison.

They are coded to generally share the same architecture, to keep it as much an apples-to-apples comparison as possible.

### Source sizes

These only include the `/app.mjs`/`/app.js` source files in each variant, and it doesn't include all the common stuff in `/common.mjs` that is largely identical. The totals exclude the usual whitespace-only lines, comment-only lines, and empty lines. The numbers are certainly compelling and intriguing, though.

**Vanilla:**

| Library                    | SLoC | Total |
|:-------------------------- |:----:|:-----:|
| Mithril redesign           | 124  |  143  |
| Mithril v1/v2              | 146  |  167  |
| React                      | 188  |  213  |
| React + experimental Hooks | 144  |  166  |

**JSX:**

| Library                    | SLoC | Total |
|:-------------------------- |:----:|:-----:|
| Mithril redesign           | 150  |  169  |
| Mithril v1/v2              | 166  |  188  |
| React                      | 210  |  239  |
| React + experimental Hooks | 163  |  185  |

*SLoC = Significant Lines of Code, if you're not familiar with the acronym.*

If you look at those SLoC numbers, one certainly sticks out to me: how *small* the Mithril redesign code is, despite it feeling a little boilerplatey in spots. It's substantially smaller than either of the rest in the vanilla variant, and is still the smallest with the overly spacious idiomatic JSX:

- Vanilla:
	- ~15% smaller than Mithril v1/v2.
	- ~34% smaller than React.
	- ~14% smaller than React + hooks.

- JSX:
	- ~10% smaller than Mithril v1/v2.
	- ~29% smaller than React.
	- ~8% smaller than React + hooks.

*If you'd like to verify these numbers, just do 1 - (size of redesign's SLoC) / (size of other's SLoC). These figures are all rounded to the nearest percent.*

Being 2/3 the size of vanilla React for functionally identical code is impressive in of itself (imagine React Redux), but being substantially smaller than even Mithril v2, which itself strips nearly all the React boilerplate away, is itself pretty impressive.

### Stability

The redesign didn't just stop at being smaller - it also kept me from even having to worry about a whole class of bugs in the process, namely not updating properties and state when I need to:

1. Cancelling requests on sudden, quick route change comes practically for free, so coding support for that was as simple as loading a simple built-in helper and passing that to the request. I had to explicitly code this for the other apps, but the small `abortable` helper from `mithril/dom` made this a small 3-line change to correct for in the redesign variant.

	```diff
	-const async = ({load, loaded}) => (o) => {
	+const async = ({load, loaded}) => abortable((signal, o) => {
	 	o.next(m("h2", "Loading"))
	-	return load().then(
	+	return load(signal).then(
	 		(response) => o.next(loaded(response)),
	 		(e) => o.next(e.status === 404
	 			? m("h2", "Not found! Don't try refreshing!")
	 			: m("h2", "Error! Try refreshing."))
	 	)
	-}
	+})
	```

1. Suppose you autolink links to different threads and convert them into just simple routing links. Assuming the router doesn't replace the view entirely, this would let you switch the thread ID directly during diffing, so that case needs handled. In the redesign variant, I didn't even remember this nuance and still got it right by accident, because it just naturally worked out that way. In fact, I would've had to *try* very awkwardly to only fetch the first thread ID. The only two easy mistakes I could've made were either forgetting to deduplicate IDs or forgetting to hook up the request for cancellation, but both of these are only minor, easily-fixed perf bugs, not major functional bug you're up at night trying to fix. It wasn't until after I started typing this up initially and when studying how the redesign variant worked that I realized I accidentally did the right thing there. The other three are a bit of a different story, and all three of them had to be fixed to update after receiving a new, different ID:
	- The React Hooks variant required me add a new parameter to account for this, equating to a small 4 line change. Note that following the ["rules of Hooks"](https://reactjs.org/docs/hooks-rules.html) wouldn't have gotten me there! (In fact, the recommended ESLint `react-hooks` plugin fix was actually *wrong* in that it wanted me to add the callback itself as a dependency when in reality it's part of the effect body.)
	- The Mithril v2 variant would've never triggered the buggy code path, since Mithril replaces the full tree when changing routes and either the old or new route is a component. If I later decided to abstract the page into a generic layout rendered via a route resolver, I would've quickly received a bug report then, because nobody would ever reasonably suspect *that* would unmask any new bugs.
	- The React variant was similar, but the bug would *not* have been masked initially. React Router never replaces its components directly, so this would've quickly shown up in a bug report later - nobody would normally think to double-check that kind of thing. I would *not* have likely noticed this when initially developing the page, though!

In general, *because* the attributes are really a stream, it's harder to forget to update state and react accordingly. I have to consciously choose *not* to update something when using the core stream utilities. But similarly, I also can flip it around and write a raw control vnode directly, in which I choose *when* to render, if at all. This is the simpler model when dealing with resource loading, since you probably want to do some form of error handling potentially.

While refactoring the examples from React JSX to all four variants having JSX + vanilla variants, I noticed that the `Home` and `Thread` routes' pages shared a *lot* of code, so I decided to replace my previous `Async` component/`async` stream with a `Layout` component that also wrapped the promise from loading the result.

- For the redesign variant, this was a magically simple code change within `async` - I just wrapped it in a `pure`, renamed it to `Layout`, and wrapped the existing returned body with the relevant shared vnodes. I then updated the callees accordingly. Overall, it was quick and painless.
- For React + its experimental hooks API, it was a similar story, but with slightly less code movement since the view was returned indirectly via its binding rather than directly from the resulting expression itself. (The diff Git would show would include far fewer lines, but most of those extra lines are just modified indentation.)
- For Mithril v1/v2 and standard React, it was a minor nuisance because I had to create a new function for Mithril v1/v2 and a new method in the React component's class. It did *not* cleanly adjust on the side of `Async`/`layout`, so I had to recast the (otherwise relatively small) view entirely.

Here's what the diffs for each of those in the vanilla version:

- Mithril redesign:

	```diff
	-const Layout = pure(({load, children: [loaded]}) => [
	-	m(Header),
	-	m("div.main", abortable((signal, o) => {
	-		o.next(m("h2", "Loading"))
	-		return load(signal).then(
	-			(response) => o.next(loaded(response)),
	-			(e) => o.next(e.status === 404
	-				? m("h2", "Not found! Don't try refreshing!")
	-				: m("h2", "Error! Try refreshing."))
	-		)
	-	}))
	-])
	+const async = ({load, loaded}) => abortable((signal, o) => {
	+	o.next(m("h2", "Loading"))
	+	return load(signal).then(
	+		(response) => o.next(loaded(response)),
	+		(e) => o.next(e.status === 404
	+			? m("h2", "Not found! Don't try refreshing!")
	+			: m("h2", "Error! Try refreshing."))
	+	)
	+})
	```

	Here's that diff with the old expressions realigned to show what's really different, since the diff does a poor job of showing what precisely changed (very little changed beyond indentation):

	```diff
	-const async  =      ({load, loaded}) =>
	+const Layout = pure(({load, children: [loaded]}) => [
	+	m(Header),
	-	              abortable((signal, o) => {
	+	m("div.main", abortable((signal, o) => {
			o.next(m("h2", "Loading"))
			return load(signal).then(
				(response) => o.next(loaded(response)),
				(e) => o.next(e.status === 404
					? m("h2", "Not found! Don't try refreshing!")
					: m("h2", "Error! Try refreshing."))
			)
	-	})
	+	}))
	+])
	```

- React + experimental hooks API:

	```diff
	-function Async({load, onLoad, children}) {
	+function Layout({load, onLoad, children}) {
	 	const [view, setView] = useState(h("h2", "Loading"))

	 	useEffect(() => {
	 		const controller = new AbortController()
	 		new Promise((resolve) => resolve(load(controller.signal)))
	 			.then((response) => {
	 				setView(children)
	 				onLoad(response)
	 			}, (e) => {
	 				setView(e.status === 404
	 					? h("h2", "Not found! Don't try refreshing!")
	 					: h("h2", "Error! Try refreshing."))
	 			})
	 		return () => controller.abort()
	 	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	-	return view
	+	return h(React.Fragment, null,
	+		h(Header, null),
	+		h("div", {className: "main"}, view)
	+	)
	 }
	```

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

	+	function pageView() {
	+		switch (state) {
	+			case "loading": return m("h2", "Loading")
	+			case "notFound": return m("h2", "Not found! Don't try refreshing!")
	+			case "error": return m("h2", "Error! Try refreshing.")
	+			default: return attrs.view()
	+		}
	+	}
	+
	 	return {
	 		onremove: () => controller.abort(),

	 		view: (vnode) => {
	 			attrs = vnode.attrs
	-			switch (state) {
	-				case "loading": return m("h2", "Loading")
	-				case "notFound": return m("h2", "Not found! Don't try refreshing!")
	-				case "error": return m("h2", "Error! Try refreshing.")
	-				default: return attrs.view()
	-			}
	+			return [
	+				m(Header),
	+				m(".main", pageView()),
	+			]
	 		},
	 	}
	 }
	```

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

	-	render() {
	+	renderPage() {
	 		switch (this.state.state) {
	 			case "loading": return h("h2", "Loading")
	 			case "notFound": return h("h2", "Not found! Don't try refreshing!")
	 			case "error": return h("h2", "Error! Try refreshing.")
	 			default: return this.props.children
	 		}
	 	}
	+
	+	render() {
	+		return h(React.Fragment, null,
	+			h(Header, null),
	+			h("div", {className: "main"}, this.renderPage())
	+		)
	+	}
	 }
	```

Here's what the diffs for each of those in the JSX version:

- Mithril redesign:

	```diff
	-const Async = pure(({load, children}) => abortable((signal, o) => {
	-	o.next(<h2>Loading</h2>)
	-	return load(signal).then(
	-		(response) => o.next(children(response)),
	-		(e) => o.next(e.status === 404
	-			? <h2>Not found! Don&apos;t try refreshing!</h2>
	-			: <h2>Error! Try refreshing.</h2>)
	-	)
	-}))
	+const Layout = pure(({load, children}) => <>
	+	<Header />
	+	<div class="main">
	+		{abortable((signal, o) => {
	+			o.next(<h2>Loading</h2>)
	+			return load(signal).then(
	+				(response) => o.next(children(response)),
	+				(e) => o.next(e.status === 404
	+					? <h2>Not found! Don&apos;t try refreshing!</h2>
	+					: <h2>Error! Try refreshing.</h2>)
	+			)
	+		})}
	+	</div>
	+</>)
	```

	Here's that diff with the old expressions realigned to show what's really different:

	```diff
	-const Async  = pure(({load, children}) =>
	+const Layout = pure(({load, children}) => <>
	+	<Header />
	+	<div class="main">
	-		 abortable((signal, o) => {
	+		{abortable((signal, o) => {
	 			o.next(<h2>Loading</h2>)
	 			return load(signal).then(
	 				(response) => o.next(children(response)),
			 		(e) => o.next(e.status === 404
			 			? <h2>Not found! Don&apos;t try refreshing!</h2>
			 			: <h2>Error! Try refreshing.</h2>)
				)
	-		})
	+		})}
	+	</div>
	+</>)
	```

- React + experimental hooks API:

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

	-	return view
	+	return <>
	+		<Header />
	+		<div className="main">{view}</div>
	+	</>
	 }
	```

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

	+	function pageView() {
	+		switch (state) {
	+			case "loading": return <h2>Loading</h2>
	+			case "notFound": return <h2>Not found! Don&apos;t try refreshing!</h2>
	+			case "error": return <h2>Error! Try refreshing.</h2>
	+			default: return attrs.view()
	+		}
	+	}
	+
	 	return {
	 		onremove: () => controller.abort(),

	 		view: (vnode) => {
	 			attrs = vnode.attrs
	-			switch (state) {
	-				case "loading": return <h2>Loading</h2>
	-				case "notFound": return <h2>Not found! Don&apos;t try refreshing!</h2>
	-				case "error": return <h2>Error! Try refreshing.</h2>
	-				default: return attrs.view()
	-			}
	+			return <>
	+				<Header />
	+				<div class="main">{pageView()}</div>
	+			</>
	 		},
	 	}
	 }
	```

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

	-	render() {
	+	renderPage() {
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
	+	render() {
	+		return <>
	+			<Header />
	+			<div className="main">{this.renderPage()}</div>
	+		</>
	+	}
	 }
	```

As you can see, it's a little easier to refactor with this redesign.
