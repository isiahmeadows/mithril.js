import {m, portal, normalize} from "./m.js"
// `./pathname/parse.js` is as defined in this PR:
// https://github.com/MithrilJS/mithril.js/pull/2361
import {parsePathname} from "./pathname/parse.js"

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
			current() {
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
			},

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

function pushHistory(state, opts) {
	state.history.push(
		state.prefix + buildPathname(opts.href, opts.params),
		opts.state, opts.title, !!opts.replace
	)
}

function relativeCurrent(href, prefix) {
	return href.startsWith(prefix) ? href.slice(prefix.length) : href
}

function checkDefault(defaultRoute, compiled) {
	const defaultData = parsePathname(default)

	if (compiled.every(check => check(defaultData) == null)) {
		throw new ReferenceError("Default route doesn't match any known routes")
	}
}

export const SKIP = m(() => {
	throw new Error("`SKIP` is to be directly returned from a route.")
})

const parent = portal()

export function Redirect(opts) {
	return m(parent.Get, parent => {
		pushHistory(parent, {...opts, replace: true})
	})
}

export function Link({tag = "div", href, children, attrs, ...opts}) {
	return m(parent.Get, parent => m(tag, {
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
			) {
				pushHistory(parent, {...opts, href: parent.prefix + href})
			}
			return false
		}
	}))
}

function updateRouter(state, entry) {
	if (state.compiled == null) {
		throw new ReferenceError("Router is not yet initialized")
	}
	const path = relativeCurrent(entry.href, state.prefix)

	if (locateCurrent(state, path, entry.state)) {
		const queue = state.resolveQueue
		state.resolveQueue = []
		const promise = state.context.update()
		for (const resolve of queue) resolve(promise)
	} else {
		if (path === state.default) {
			throw new Error(`Could not resolve default route ${path}`)
		}

		state.history.push(state.prefix + state.default, null, null, true)
	}
}

function locateCurrent(state, path, stateParams) {
	const data = parsePathname(path)
	Object.assign(data.params, stateParams)
	const matched = state.compiled
		.map((check, i) => [i, check(data)])
		.filter(([i, params]) => params != null)
		.map(([i, params]) => ({key: state.routeKeys[i], params}))

	if (matched.length === 0) return false
	state.matched = matched
	state.parentPrefix = data.prefix
	state.matchOffset = 0
	return true
}

function RouterInternal(
	{attrs, parent}, context,
	state = {
		compiled: undefined,
		context: undefined,
		current: undefined,
		default: undefined,
		history: undefined,
		matched: undefined,
		matchOffset: 0,
		parentPrefix: undefined,
		prefix: undefined,
		resolveQueue: [],
		routeKeys: undefined,
		router: undefined,
		unsubscribe: undefined,
	}
) {
	let {prefix, default: defaultRoute, history} = attrs
	let current
	defaultRoute = String(defaultRoute)

	if (parent != null) {
		history = parent.history
		prefix = parent.prefix + parent.parentPrefix
		if (parent.current != null) {
			current = relativeCurrent(parent.current, prefix)
		}
	} else {
		current = state.current = attrs.current
		if (prefix == null) prefix = "#!"
		// Don't set a default if no history exists.
		if (history == null && domHistories != null) {
			history = domHistories[
				prefix[0] === "#" ? 2 : prefix[0] === "?" ? 1 : 0
			]
		}

		if (history == null && current == null) {
			throw new Error(
				"`history` must exist if `current` is omitted and no DOM exists"
			)
		}
	}

	const routeKeys = Object.keys(attrs).filter(route => route[0] === "/")

	if (routeKeys.some(route => (/:([^\/\.-]+)(\.{3})?:/).test(route))) {
		throw new SyntaxError(
			"Route parameter names must be separated with either " +
			"`/`, `.`, or `-`"
		)
	}

	const shouldCompile = state.routeKeys == null ||
		routeKeys.length === state.routeKeys.length &&
		routeKeys.every((route, i) => route === state.routeKeys[i])

	// These need to be always up to date
	state.context = context
	state.prefix = prefix

	// These have to be always up to date for the callback.
	if (state.history !== history) {
		state.history = history
		if (state.unsubscribe != null) (0, state.unsubscribe)()
		state.unsubscribe = state.history != null
			// Note: this closure *must* only reference `state`, since its
			// contents are always kept up to date. This is enforced by doing
			// the actual updating in a separate function.
			? state.history.subscribe(entry => { updateRouter(state, entry) })
			: undefined
	}

	if (shouldCompile) {
		const compiled = routeKeys.map(compileTemplate)
		checkDefault(defaultRoute, compiled)
		// In case the subscriber gets called synchronously (as is the case with
		// the memory router).
		state.routeKeys = routeKeys
		state.compiled = compiled
	} else if (defaultRoute !== state.default) {
		checkDefault(defaultRoute, state.compiled)
	}

	state.default = defaultRoute

	if (current != null && !locateCurrent(
		state,
		typeof current === "string" ? current : current.href,
		typeof current === "string" ? null : current.state
	)) {
		throw new ReferenceError("`current` must correspond to a route")
	}

	state.current = current

	for (let i = state.matchOffset; i < state.matched.length; i++) {
		const {key, params} = state.matched[i]
		const view = normalize(attrs[key](params, {
			current() {
				const entry = state.history.current()
				return {
					href: relativeCurrent(entry.href, state.prefix),
					state: entry.state,
				}
			},

			push(opts) {
				if (typeof opts === "string") opts = {href: opts}
				return new Promise(resolve => {
					state.resolveQueue.push(resolve)
					pushHistory(state, opts)
				})
			},

			pop() {
				return new Promise(resolve => {
					state.resolveQueue.push(resolve)
					state.history.pop()
				})
			},
		}))

		if (view !== Skip) {
			state.matchOffset = i
			return {next: state, view: m(parent.Set, {value: state}, view)}
		}
	}

	state.history.push(state.prefix + state.default, null, null, true)
	return {next: state, view: undefined}
}

export function Router(attrs) {
	return m(parent.Get, parent => m(RouterInternal, {attrs, parent}))
}
