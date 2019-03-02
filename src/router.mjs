// `./pathname/build.js` and `./pathname/parse.js` are as defined in this PR:
// https://github.com/MithrilJS/mithril.js/pull/2361
import buildPathname from "./pathname/build.js"
import {m} from "./hyperscript.js"
import matchTemplate from "./pathname/match.js"
import parsePathname from "./pathname/parse.js"

function create(init) {
	const contexts = new Map()
	let currentQueue = []
	let currentPromises = []

	function update(method, opts) {
		if (typeof opts === "string") opts = {href: opts}
		return new Promise((resolve) => {
			currentQueue.push(resolve)
			router.history[method](
				buildPathname(opts.href, opts.params),
				opts.state, opts.title,
			)
		})
	}

	function cleanup(token) {
		return () => contexts.delete(token)
	}

	function Dispatch({
		current = router.history.current(),
		default: defaultRoute, ...routes
	}, context, token = {}) {
		contexts.set(token, context)

		const resolved = typeof current === "string"
			? {href: current, state: undefined}
			: current

		if (!(/^\//).test(resolved.href)) {
			throw new SyntaxError("The current route must start with a `/`")
		}

		const data = parsePathname(resolved.href)
		Object.assign(data.params, resolved.state)
		let prefix = ""

		matcher:
		for (;;) {
			for (const route of Object.keys(routes)) {
				const match = matchTemplate(prefix, route, data)
				if (match == null) continue

				const result = routes[route](match.params)
				if (result === router) continue
				if (result != null && typeof result === "object") {
					for (const key in result) {
						if (
							{}.hasOwnProperty.call(result, key) &&
							key[0] === "/"
						) {
							const {
								default: newDefaultRoute, ...newRoutes
							} = result
							prefix = match.prefix
							defaultRoute = prefix + newDefaultRoute
							routes = newRoutes
							continue matcher
						}
					}
				}

				// Resolve some promises now that we're really ready to
				// render the route.
				const queue = currentQueue
				const promise = currentPromises.length
					? Promise.all(currentPromises).then(() => {}, () => {})
					: undefined
				currentQueue = []
				currentPromises = []
				for (const resolve of queue) resolve(promise)

				return {ref: token, view: result}
			}

			router.history.replace(defaultRoute, null, null)
			return {ref: token, view: undefined}
		}
	}

	const router = {
		create,

		Link: ({children, ...opts}) => {
			if (Array.isArray(children)) children = children[0]
			const onclick = typeof children.attrs.onclick === "function"
				? children.attrs.onclick
				: undefined

			children.attrs.href =
				(router.history.prefix || "") + children.attrs.href

			children.attrs.onclick = function (ev) {
				const canChangeRoute =
					typeof onclick !== "function" ||
					onclick.apply(this, arguments) !== false &&
					ev.defaultPrevented
				if (
					canChangeRoute &&
					!ev.ctrlKey && !ev.metaKey &&
					!ev.shiftKey && ev.which !== 2
				) update("push", opts)
				return false
			}

			return children
		},

		history: init(() => {
			for (const context of contexts.values()) {
				currentPromises.push(new Promise((resolve) => {
					resolve(context.update())
				}))
			}
		}),

		push: (opts) => update("push", opts),
		replace: (opts) => update("replace", opts),

		pop: () => new Promise((resolve) => {
			currentQueue.push(resolve)
			router.history.pop()
		}),

		match: (attrs) => m(Dispatch, {...attrs, ref: cleanup}),
	}

	return router
}

export default create((onchange) => {
	let scheduled, prev, parts

	// The logic here is a workaround for these two:
	// - https://github.com/MithrilJS/mithril.js/issues/2060
	// - https://github.com/MithrilJS/mithril.js/pull/881
	// It encodes percents starting invalid non-ASCII escape sequences so they
	// get deserialized into themselves.
	const normalizeRegexp = new RegExp(
		// Invalid 1-byte escape
		"%(?:[0-7](?![\\da-f])|[89ab]|" +
		// Invalid 2-byte escape
		"[cd](?![\\da-f]%[89ab][\\da-f])|" +
		// Invalid 3-byte escape
		"e(?![\\da-f](?:%[89ab][\\da-f]){2})|"+
		// Invalid 4-byte escape
		"f(?![\\da-f](?:%[89ab][\\da-f]){3}))",
		"gi"
	)

	function current() {
		if (!hasWindow) {
			throw new ReferenceError(
				"Cannot access current history without a DOM"
			)
		}

		// Let's try to avoid this on repeated accesses
		if (window.location.href !== prev) {
			prev = window.location.href
			parts = ""
			if (history.prefix[0] !== "?" && history.prefix[0] !== "#") {
				parts += window.location.pathname
			}
			if (history.prefix[0] !== "#") parts += window.location.search
			parts += window.location.hash
			if ((/^[#?]/).test(parts)) parts = parts.slice(1)
			parts = parts.replace(normalizeRegexp, "%25")
			if (parts !== "" && parts[0] !== "/") parts = `/${parts}`
		}

		return {
			href: parts.startsWith(history.prefix)
				? parts.slice(history.prefix.length)
				: parts,
			state: window.history.state,
		}
	}

	const hasWindow = typeof window === "object" && window != null
	const history = {
		prefix: "#!", current,

		push(href, state, title) {
			if (!hasWindow) {
				throw new ReferenceError("Cannot update history without a DOM")
			}

			window.history.pushState(state, title, history.prefix + href)
			schedule()
		},

		replace(href, state, title) {
			if (!hasWindow) {
				throw new ReferenceError("Cannot update history without a DOM")
			}

			window.history.replaceState(state, title, history.prefix + href)
			schedule()
		},

		pop() {
			if (!hasWindow) {
				throw new ReferenceError("Cannot update history without a DOM")
			}

			// This will eventually cause `popstate` to be emitted.
			window.history.back()
		},
	}

	function schedule() {
		if (scheduled) return
		scheduled = true
		setTimeout(() => {
			scheduled = false
			onchange(current())
		}, 0)
	}

	// Subscribe only if there's a window to speak of.
	if (hasWindow) window.addEventListener("popstate", schedule, false)
	return history
})
