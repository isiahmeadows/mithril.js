// Note: if you want to optimize this library's size, *please* test the min+gzip
// size. For example, you might choose to run this command if you have `gzip` +
// `wc` installed:
//
// ```sh
// # Rollup and Terser come from `./node_modules/.bin`
// # Also, this is a single line. The `\` escapes the line break in Bash, but
// # on Windows, that obviously won't work as they use `^` instead.
// rollup -i packages/mithril/src/stream.mjs -n Mithril.Stream \
//     --amd.id mithril/stream -f umd | terser -cm | gzip | wc -c
// ```
//
// You might be surprised to find some of what compresses better than others.
// There's a lot of repetition within this, but it compresses *very* well.
function noop() {}

var SKIP = {}
var sentinel = {}
var fill = Array.prototype.fill || function (value) {
	for (var i = 0; i < this.length; i++) this[i] = value
	return this
}

function invokeNext(hooks, value) {
	if (hooks != null && typeof hooks.next === "function") {
		hooks.next(value)
	}
}

function invokeError(hooks, value) {
	if (hooks != null && typeof hooks.error === "function") {
		hooks.error(value)
	}
}

function invokeComplete(hooks, value) {
	if (hooks != null && typeof hooks.complete === "function") {
		hooks.complete(value)
	}
}

// TL;DR: Async is hard. This is just one giant, condensed, ugly state machine.
// If you aren't interested in understanding the arcane wizardry below, feel
// free to stop reading right here and skip from here to the end of `receive`.
//
// Merging, flattening, and joining seems obvious, until you consider the
// following:
//
// - If one dependency terminates for some reason, the rest should be closed.
// - If, while closing one dependent stream, other dependent streams terminate,
//   those streams that terminated themselves should not be "closed" again.
// - If, while closing one dependent stream, a new stream could be subscribed
//   to and added, so I can't assume the token is even in the same spot during
//   subscription.
// - Synchronous exceptions should be removed in response if necessary.
// - Memory leaks should be avoided if at all possible.
// - All this could in theory be called recursively.
//
// Or to put it another way, if all you've done is just *use* streams, throw out
// any and all intuition you once had about them, because nothing here will
// align with it. None of these beautiful high-level assumptions will hold at
// the low level this targets. (I really feel sorry for OS developers who have
// to put up with worse than this at a much larger scale - every single
// instruction could be pre-emptively interrupted, so they have to explicitly
// disable interrupts just to atomically update stored data.)
//
// This is why this nifty little function exists. To encapsulate all that nasty
// arcane black magic bound to make your eyes bleed. Nearly every state you can
// think of is valid, even if it doesn't sound like it should be. So if you want
// to "optimize" this, you need to consider its semantics first, and they aren't
// simple. I've tried to explain how this works as best as I can, but it's still
// a bit more complicated than it looks.
function trackerCreate(extra) {
	return {s: [], e: extra}
}

function trackerCloseAll(t) {
	var list = t.s
	t.s = t.e = undefined
	if (list != null) {
		var error = sentinel

		for (var i = 1; i < list.length; i += 2) {
			try {
				list[i]()
			} catch (e) {
				error = e
			}
		}

		if (sentinel !== error) throw error
	}
}

// Note:
// `type === 0` = `all`
// `type === 1` = `merge`, `chain` inner
// `type === 2` = `chain` outer (post-flatten)
function trackerConnect(t, stream, hooks, type, extra) {
	if (t.s == null) return false
	var parent = t
	var token = {}
	var index = t.s.length
	var done = sentinel
	t.s.push(token, undefined)
	function error(value) {
		var tracker = parent, target = hooks
		token = parent = hooks = extra = undefined
		if (tracker == null) return
		trackerCloseAll(tracker)
		invokeError(target, value)
	}
	try {
		done = stream({
			next: function (value) {
				if (parent == null) return
				if (type === 0) {
					parent.e[extra] = value
					if (parent.e.indexOf(sentinel) >= 0) return
					invokeNext(hooks, parent.e.slice())
				} else if (type === 1) {
					invokeNext(hooks, value)
				} else {
					trackerConnect(parent, value, hooks, 1)
				}
			},
			error: error,
			complete: function () {
				var tracker = parent, target = hooks
				token = parent = hooks = extra = undefined
				if (tracker == null) return
				if (type === 0) {
					trackerCloseAll(tracker)
				} else {
					tracker.s.splice(tracker.s.indexOf(token), 2)
					if (tracker.s.length !== 0) return
					tracker.s = tracker.e = undefined
				}
				invokeComplete(target)
			},
		})
		return token == null
	} finally {
		// If the child has already closed, we shouldn't register it to
		// later be closed. I can't just use an early `return` because
		// that would replace any existing exception that was thrown.
		if (token != null) {
			// Let's try to skip finding the index if we can.
			if (index > t.s.length || t.s[index] !== token) {
				index = t.s.indexOf(token)
			}
			if (sentinel !== done) {
				// If we successfully initialized, we can set the
				// `done` value appropriately.
				t.s[index + 1] = done
			} else {
				// If we failed to initialize, we need to remove the
				// token and ignore further emits.
				t.s.splice(index, 2)
				parent = undefined
			}
		}
	}
}

function sameValueZero(a, b) {
	return a === b || a !== a && b !== b
}

function NEVER(hooks) {
	invokeComplete(hooks)
	return noop
}

// This could easily be frequently used, so it's optimized likewise for
// performance, even at the mild cost of size.
function remove(subs, index, token) {
	if (subs == null) return false
	if (subs.length <= index || subs[index] !== token) {
		index = subs.indexOf(token)
		if (index < 0) return false
	}
	subs.splice(index, 3)
	return true
}

function store(acc, func) {
	var subs = []
	return [
		function (hooks) {
			if (hooks == null || typeof hooks !== "object") return noop
			if (subs == null) {
				invokeComplete(hooks)
				return noop
			}
			var token = {}
			var index = subs.length
			subs.push(token, hooks)
			try {
				invokeNext(hooks, acc)
				return function () {
					remove(subs, index, token)
				}
			} catch (e) {
				if (remove(subs, index, token)) {
					invokeError(hooks, e)
				}
				return noop
			}
		},
		function (value) {
			if (subs == null) return
			if (typeof func === "function") {
				value = func(acc, value)
				if (SKIP === value) return
			}
			if (sentinel !== acc) acc = value
			// Don't let it shift out from under me.
			var current = subs.slice()
			for (var i = 1; i < current.length; i += 2) {
				invokeNext(current[i], value)
			}
		}
	]
}

function never() {
	return NEVER
}

// See the tracker code for all the complexity hidden from this implementation.
function all(streams) {
	// Shortcut a known easy case.
	if (streams.length === 0 || streams.indexOf(NEVER) >= 0) return NEVER
	return function (hooks) {
		var tracker = trackerCreate(
			fill.call(new Array(streams.length), sentinel)
		)

		for (var i = 0; i < streams.length; i++) {
			trackerConnect(tracker, streams[i], hooks, 0, i)
		}

		return function () {
			trackerCloseAll(tracker)
		}
	}
}

function join(streams) {
	var keys = Object.keys(streams)
	// Shortcut a known easy case.
	if (keys.length === 0) return NEVER
	var values = []
	for (var i = 0; i < keys.length; i++) values[i] = streams[keys[i]]
	return map(all(values), function (currents) {
		var object = Object.create(null)
		for (var j = 0; j < keys.length; j++) object[keys[j]] = currents[j]
		return object
	})
}

function run(value) {
	for (var i = 1; i < arguments.length; i++) value = (0, arguments[i])(value)
	return value
}

function map(stream, func) {
	// Shortcut a known easy case.
	if (NEVER === stream) return NEVER
	return function (hooks) {
		function error(value) {
			var target = hooks
			hooks = sub = undefined
			invokeError(target, value)
		}
		var sub = sentinel
		var maybeSub = stream({
			next: function (value) {
				if (hooks != null) {
					try {
						value = func(value)
					} catch (e) {
						error(e)
						return
					}
					if (SKIP !== value) invokeNext(hooks, value)
				}
			},
			error: error,
			complete: function () {
				var target = hooks
				hooks = sub = undefined
				invokeComplete(target)
			},
		})
		if (sentinel === sub) sub = maybeSub
		return function () {
			var target = sub
			hooks = sub = undefined
			target()
		}
	}
}

function distinct(stream, compare) {
	// Shortcut a known easy case.
	if (NEVER === stream) return NEVER
	if (compare == null) compare = sameValueZero
	return function (hooks) {
		var acc = sentinel, sub = sentinel
		function error(value) {
			var target = hooks
			hooks = sub = acc = undefined
			invokeError(target, value)
		}
		var maybeSub = stream({
			next: function (value) {
				if (hooks != null) {
					var prev = acc
					acc = value
					if (sentinel !== prev) {
						try {
							if (compare(prev, value)) return
						} catch (e) {
							error(e)
							return
						}
					}
					invokeNext(hooks, value)
				}
			},
			error: error,
			complete: function () {
				var target = hooks
				hooks = sub = acc = undefined
				invokeComplete(target)
			},
		})
		if (sentinel === sub) sub = maybeSub
		return function () {
			var target = sub
			hooks = acc = sub = undefined
			target()
		}
	}
}

// See the tracker code for all the complexity hidden from this implementation.
function merge() {
	var streams = []
	for (var i = 0; i < arguments.length; i++) {
		// Shortcut a known easy case.
		if (NEVER !== arguments[i]) streams.push(arguments[i])
	}
	// Shortcut a known easy case.
	if (streams.length === 0) return NEVER
	if (streams.length === 1) return arguments[0]
	return function (hooks) {
		var tracker = trackerCreate()

		for (var i = 0; i < streams.length; i++) {
			trackerConnect(tracker, streams[i], hooks, 1, i)
		}

		return function () {
			trackerCloseAll(tracker)
		}
	}
}

// See the tracker code for all the complexity hidden from this implementation.
function chain(stream, func) {
	// Shortcut a known easy case.
	if (NEVER === stream) return NEVER
	stream = map(stream, func)
	return function (hooks) {
		var tracker = trackerCreate()
		trackerConnect(tracker, stream, hooks, 2)
		return function () {
			trackerCloseAll(tracker)
		}
	}
}

function onClose(stream, func) {
	return function (hooks) {
		// Shortcut a known easy case.
		if (NEVER === stream) {
			try {
				func()
			} finally {
				invokeComplete(hooks)
			}
			return noop
		}
		var sub = sentinel
		var maybeSub = stream({
			next: function (value) {
				invokeNext(hooks, value)
			},
			error: function (error) {
				var target = hooks
				hooks = sub = undefined
				if (sub != null) {
					try {
						func()
					} finally {
						invokeError(target, error)
					}
				}
			},
			complete: function () {
				var target = hooks
				hooks = sub = undefined
				if (sub != null) {
					try {
						func()
					} finally {
						invokeComplete(target)
					}
				}
			},
		})
		if (sub === sentinel) sub = maybeSub

		return function () {
			var target = sub
			hooks = sub = sentinel
			if (sub != null) {
				try {
					func()
				} finally {
					target()
				}
			}
		}
	}
}

function recover(stream, func) {
	return function (hooks) {
		var flipped = false
		var sub = sentinel
		var maybeSub = stream({
			next: function (value) {
				invokeNext(hooks, value)
			},
			error: function (value) {
				flipped = true
				if (hooks != null) {
					try {
						var stream = func(value)
						if (hooks != null) {
							sub = sentinel
							var maybeSub = stream({
								next: function (value) {
									invokeNext(hooks, value)
								},
								error: function (value) {
									invokeError(hooks, value)
								},
								complete: function () {
									var target = hooks
									sub = hooks = undefined
									invokeComplete(target)
								},
							})
							if (sentinel === sub) sub = maybeSub
						}
					} catch (e) {
						invokeError(hooks, e)
					}
				}
			},
			complete: function () {
				invokeComplete(hooks)
			},
		})
		// If it errored synchronously, let's not bother allocating a new
		// function.
		if (flipped) return sub
		if (sentinel === sub) sub = maybeSub
		return function () {
			var target = sub
			hooks = sub = undefined
			target()
		}
	}
}

export {
	all,
	chain,
	distinct,
	join,
	map,
	merge,
	never,
	onClose,
	recover,
	run,
	SKIP,
	store,
}
