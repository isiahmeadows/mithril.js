import {PortalGet, PortalSet, m, normalize} from "./m.js"
// `./pathname/parse.js` is as defined in this PR:
// https://github.com/MithrilJS/mithril.js/pull/2361
import buildPathname from "./pathname/build.js"
import compileTemplate from "./pathname/compile.js"
import parsePathname from "./pathname/parse.js"

// The logic here is a workaround for these two:
// - https://github.com/MithrilJS/mithril.js/issues/2060
// - https://github.com/MithrilJS/mithril.js/pull/881
// It encodes percents starting invalid non-ASCII escape sequences so they get
// deserialized into themselves.
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

// Set this only if there's a window to speak of.
const domHistories = typeof window !== "object" || window == null
	? undefined
	// Note:
	// `level === 0` = include pathname + search + hash
	// `level === 1` = include search + hash
	// `level === 2` = include hash
	: Array.from({length: 2}, (_, level) => {
		const subscribers = new Map()
		let scheduled = false
		let prev, parts

		function current() {
			// Let's try to avoid this on repeated accesses
			if (window.location.href !== prev) {
				prev = window.location.href
				parts = ""
				if (level === 0) parts += window.location.pathname
				if (level !== 2) parts += window.location.search
				parts += window.location.hash
				if (/^[#?]/.test(parts)) parts = parts.slice(1)
				parts = parts.replace(normalizeRegexp, "%25")
				if (parts[0] !== "/") parts = `/${parts}`
			}

			return {href: parts, state: window.history.state}
		}

		function schedule() {
			if (scheduled) return
			scheduled = true
			setTimeout(() => {
				scheduled = false
				const entry = current()
				for (const sub of subscribers.values()) sub(entry)
			}, 0)
		}

		window.addEventListener("popstate", schedule, false)

		return {
			current,

			push(href, state, title, replace) {
				if (replace) window.history.replaceState(state, title, href)
				else window.history.pushState(state, title, href)
				schedule()
			},

			pop() {
				window.history.back()
			},

			subscribe(callback) {
				const token = {}
				subscribers.set(token, callback)
				return () => subscribers.delete(token)
			},
		}
	})

function pushHistory(history, prefix, opts) {
	history.push(
		prefix + buildPathname(opts.href, opts.params),
		opts.state, opts.title, Boolean(opts.replace)
	)
}

function relativeCurrent(href, prefix) {
	return href.startsWith(prefix) ? href.slice(prefix.length) : href
}

function checkDefault(defaultRoute, compiled) {
	const defaultData = parsePathname(defaultRoute)

	if (compiled.every((check) => check(defaultData) == null)) {
		throw new ReferenceError("Default route doesn't match any known routes")
	}
}

export const SKIP = m(() => {
	throw new Error("`SKIP` is to be directly returned from a route.")
})

const Parent = {}
const Current = {}

export function Redirect(opts) {
	return m(PortalGet, {token: Parent}, (parent) => {
		pushHistory(parent.history, parent.prefix, {...opts, replace: true})
	})
}

export function Link({tag = "div", href, children, attrs, ...opts}) {
	return m(PortalGet, {token: Parent}, (parent) => m(tag, {
		children, ...attrs,
		href: parent.prefix + href,
		onclick(ev) {
			const defaultPrevented =
				typeof attrs.onclick === "function" &&
				attrs.onclick(ev) === false || ev.defaultPrevented
			if (
				!defaultPrevented &&
				!ev.ctrlKey && !ev.metaKey &&
				!ev.shiftKey && ev.which !== 2
			) pushHistory(parent.history, parent.prefix, opts)
			return false
		}
	}))
}

export function Router(ignoredAttrs, context) {
	let matchedOffset = 0
	let resolveQueue = []
	let compiled, routeKeys, currentContext, currentDefault, currentMatched
	let currentHistory, currentParentPrefix, currentPrefix
	let unsubscribe

	function updateRouter(entry) {
		if (compiled == null) {
			throw new ReferenceError("Router is not yet initialized")
		}
		const path = relativeCurrent(entry.href, currentPrefix)

		if (locateCurrent(path, entry.state)) {
			const queue = resolveQueue
			resolveQueue = []
			const promise = currentContext.update()
			for (const resolve of queue) resolve(promise)
		} else {
			if (path === currentDefault) {
				throw new Error(`Could not resolve default route ${path}`)
			}

			currentHistory.push(
				currentPrefix + currentDefault,
				null, null, true
			)
		}
	}

	function locateCurrent(path, state) {
		const data = parsePathname(path)
		Object.assign(data.params, state)
		const matched = compiled
			.map((check, i) => [i, check(data)])
			.filter(([, params]) => params != null)
			.map(([i, params]) => ({key: routeKeys[i], params}))

		if (matched.length === 0) return false
		currentMatched = matched
		currentParentPrefix = data.prefix
		matchedOffset = 0
		return true
	}

	return (attrs) => m(PortalGet, {token: Current}, (parentCurrent) =>
		m(PortalGet, {token: Parent}, (parent) => {
			let {prefix, history, current} = attrs
			const {default: defaultRoute} = attrs
			let updateCurrent = current != null

			if (parent != null) {
				history = parent.history
				prefix = parent.prefix + parent.parentPrefix
				updateCurrent = false
				current = parentCurrent != null
					? relativeCurrent(parentCurrent, prefix)
					: undefined
			} else {
				if (prefix == null) prefix = "#!"
				// Don't set a default if no history exists.
				if (history == null && domHistories != null) {
					history = domHistories[
						prefix[0] === "#" ? 2 : prefix[0] === "?" ? 1 : 0
					]
				}

				if (history == null && current == null) {
					throw new Error(
						"`history` must exist if `current` is omitted and no DOM " +
						"exists"
					)
				}
			}

			const newRouteKeys = Object.keys(attrs).filter((route) => route[0] === "/")

			if (newRouteKeys.some((route) => (/:([^\/\.-]+)(\.{3})?:/).test(route))) {
				throw new SyntaxError(
					"Route parameter names must be separated with either " +
				"`/`, `.`, or `-`"
				)
			}

			const shouldCompile = routeKeys == null ||
			newRouteKeys.length === routeKeys.length &&
			newRouteKeys.every((route, i) => route === routeKeys[i])

			// These need to be always up to date
			currentContext = context
			currentPrefix = prefix

			// These have to be always up to date for the callback.
			if (currentHistory !== history) {
				currentHistory = history
				if (unsubscribe != null) unsubscribe()
				unsubscribe = history != null
					? history.subscribe(updateRouter)
					: undefined
			}

			if (shouldCompile) {
				const newCompiled = newRouteKeys.map(compileTemplate)
				checkDefault(defaultRoute, newCompiled)
				// In case the subscriber gets called synchronously.
				routeKeys = newRouteKeys
				compiled = newCompiled
			} else if (defaultRoute !== currentDefault) {
				checkDefault(defaultRoute, compiled)
			}

			currentDefault = defaultRoute

			if (current != null && !locateCurrent(
				typeof current === "string" ? current : current.href,
				typeof current === "string" ? null : current.state
			)) {
				throw new ReferenceError("`current` must correspond to a route")
			}

			for (let i = matchedOffset; i < currentMatched.length; i++) {
				const {key, params} = currentMatched[i]
				const view = normalize(attrs[key](params, {
					current() {
						const {href, state} = currentHistory.current()
						return {
							href: relativeCurrent(href, prefix),
							state,
						}
					},

					push(opts) {
						if (typeof opts === "string") opts = {href: opts}
						return new Promise((resolve) => {
							resolveQueue.push(resolve)
							pushHistory(currentHistory, prefix, opts)
						})
					},

					pop() {
						return new Promise((resolve) => {
							resolveQueue.push(resolve)
							currentHistory.pop()
						})
					},
				}))

				if (view !== SKIP) {
					matchedOffset = i
					const result = m(PortalSet, {
						token: Parent,
						value: {
							history, prefix,
							parentPrefix: currentParentPrefix,
						}
					}, view)
					return updateCurrent
						? m(PortalSet, {token: Current, value: current}, result)
						: result
				}
			}

			history.push(prefix + currentDefault, null, null, true)
			return undefined
		}))
}
