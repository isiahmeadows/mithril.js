// `./pathname/build.js` and `./pathname/parse.js` are as defined in this PR:
// https://github.com/MithrilJS/mithril.js/pull/2361
import buildPathname from "./pathname/build.js"
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

	const router = {
		create,

		Link: (attrs) => {
			const target = Array.isArray(attrs.children)
				? attrs.children[0]
				: attrs.children
			const onclick = typeof target.attrs.onclick === "function"
				? target.attrs.onclick
				: undefined

			target.attrs.href =
				(router.history.prefix || "") + target.attrs.href

			target.attrs.onclick = function (ev) {
				let canChangeRoute = true

				if (typeof onclick === "function") {
					canChangeRoute = onclick.call(this, ev) !== false
				} else if (onclick != null && typeof onclick === "object") {
					onclick.handleEvent(ev)
				}

				if (
					// Skip if `onclick` prevented default
					canChangeRoute && !ev.defaultPrevented &&

					// Ignore everything but left clicks
					(ev.button === 0 || ev.which === 0 || ev.which === 1) &&

					// let browser handle `target=_blank`, etc.
					(!this.target || this.target === "_self") &&

					// No modifier keys
					!ev.ctrlKey && !ev.metaKey && !ev.shiftKey && !ev.altKey
				) update("push", attrs)

				return false
			}

			return target
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

		match: (attrs) => (context, token = {}) => {
			contexts.set(token, context)
			const done = () => contexts.delete(token)
			const current = attrs.current || router.history.current()
			let defaultRoute = attrs.route
			let routes = attrs

			const resolved = typeof current === "string"
				? {href: current, state: undefined}
				: current

			if (!(/^\//).test(resolved.href)) {
				throw new SyntaxError("The current route must start with a `/`")
			}

			const data = parsePathname(resolved.href)
			Object.assign(data.params, resolved.state)
			let offset = 0

			matcher:
			for (;;) {
				for (const route of Object.keys(routes)) {
					if (route === "current" || route === "default") return
					const match = matchTemplate(
						data.href.slice(offset),
						route, data.params
					)
					if (match == null) continue

					const result = routes[route](match.params)
					if (result === router) continue
					if (result != null && typeof result === "object") {
						for (const key in result) {
							if (
								{}.hasOwnProperty.call(result, key) &&
								key[0] === "/"
							) {
								offset += match.prefix.length
								defaultRoute = match.prefix + result.default
								routes = result
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

					return {value: result, done}
				}

				router.history.replace(defaultRoute, null, null)
				return {value: undefined, done}
			}
		},
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
