// `./pathname/build.js` and `./pathname/parse.js` are as defined in this PR:
// https://github.com/MithrilJS/mithril.js/pull/2361
import buildPathname from "./pathname/build.js"
import matchTemplate from "./pathname/match.js"
import parsePathname from "./pathname/parse.js"

const NEXT = {}

function create(init) {
	const tokens = []
	let currentQueue = []
	let renderedPromises = []

	const history = init(() => {
		for (const token of tokens) token.pending = true
		for (const token of tokens) match(token)
	})

	function update(method, opts) {
		if (typeof opts === "string") opts = {href: opts}
		return new Promise((resolve) => {
			currentQueue.push(resolve)
			history[method](
				buildPathname(opts.href, opts.params),
				opts.state, opts.title,
			)
		})
	}

	function match(token) {
		body: {
			try {
				const current = token.attrs.current || history.current()
				let defaultRoute = token.attrs.default
				let routes = token.attrs

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
						if (route === "current" || route === "default") continue
						const match = matchTemplate(
							data.href.slice(offset),
							route, data.params
						)
						if (match == null) continue

						const result = routes[route](match.params)
						if (result === NEXT) continue
						if (result != null && typeof result === "object") {
							for (const key in Object.keys(result)) {
								if (key[0] === "/") {
									offset += match.prefix.length
									defaultRoute = match.prefix + result.default
									routes = result
									continue matcher
								}
							}
						}

						renderedPromises.push((0, token.render)(result))
						break body
					}

					// Skip the process altogether.
					history.replace(defaultRoute, null, null)
					return
				}
			} catch (e) {
				renderedPromises.push(Promise.reject(e))
			}
		}

		token.pending = false
		for (const token of tokens) {
			if (token.pending) return
		}
		// Resolve the promises now that we're done trying to render routes.
		const queue = currentQueue
		const promises = renderedPromises
		currentQueue = []
		renderedPromises = []
		for (const resolve of queue) resolve(promises)
	}

	return {
		create, history, NEXT,

		Link: (attrs) => {
			const target = Array.isArray(attrs.children)
				? attrs.children[0]
				: attrs.children
			const onclick = typeof target.attrs.onclick === "function"
				? target.attrs.onclick
				: undefined

			target.attrs.href =
				(history.prefix || "") + target.attrs.href

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

					// Let the browser handle `target="_blank"`, etc.
					(!this.target || this.target === "_self") &&

					// No modifier keys
					!ev.ctrlKey && !ev.metaKey && !ev.shiftKey && !ev.altKey
				) update("push", attrs)

				return false
			}

			return target
		},

		push: (opts) => update("push", opts),
		replace: (opts) => update("replace", opts),

		pop: () => new Promise((resolve) => {
			currentQueue.push(resolve)
			history.pop()
		}),

		match: (attrs) => (render) => {
			const token = {render, pending: false, attrs: undefined}
			tokens.push(token)
			const done = attrs((attrs) => {
				token.attrs = attrs
				token.pending = true
				match(token)
			})
			return () => {
				const index = tokens.indexOf(token)
				if (index >= 0) tokens.splice(index, 1)
				return done()
			}
		},
	}
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
