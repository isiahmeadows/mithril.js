import {assign} from "./util.mjs"

export var emptyAttrs = Object.freeze({children: []})

// This algorithm is equivalent to `m("elem", attrs).attrs`, but specialized for
// that particular call.
export function normalizeElemAttrs(attrs) {
	// Let's short-circuit this early.
	if (attrs == null) return emptyAttrs

	// This also safeguards against if this is parsed in sloppy mode for
	// whatever reason (like if this is in ES5)
	var children, replacement

	if (attrs == null) {
		children = []
	} else if (typeof attrs !== "object" || Array.isArray(attrs)) {
		return {children: [attrs]}
	} else if ((children = attrs.children) != null) {
		// If `children: ...` is present, this takes precedence in
		// determining this as an attributes object, even if `tag` is
		// present. If you want a literal attribute `tag`, you can have that
		// provided you pass `children: []` as well.
		if (Array.isArray(children)) return attrs
		// Normalize non-arrays to arrays, but ignore remaining children.
		children = [children]
	} else if (attrs.tag != null) {
		children = []
	} else {
		return {children: attrs}
	}

	replacement = {}
	assign(replacement, attrs)
	replacement.children = children
	return replacement
}
