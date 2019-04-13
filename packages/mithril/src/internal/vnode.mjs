import {assign} from "./util.mjs"
// Call via `mergeAttrsChildren.apply(undefined, arguments)`
//
// The reason I do it this way, forwarding the arguments and passing the start
// offset in `this`, is so I don't have to create a temporary array in a
// performance-critical path.
//
// In native ES6, I'd instead add a final `...args` parameter to the
// `hyperscript` and `fragment` factories and define this as
// `hyperscriptVnode(...args)`, since modern engines do optimize that away. But
// ES5 (what Mithril requires thanks to IE support) doesn't give me that luxury,
// and engines aren't nearly intelligent enough to do either of these:
//
// 1. Elide the allocation for `[].slice.call(arguments, 1)` when it's passed to
//    another function only to be indexed.
// 2. Elide an `arguments` allocation when it's passed to any function other
//    than `Function.prototype.apply` or `Reflect.apply`.
//
// In ES6, it'd probably look closer to this (I'd need to profile it, though):
// export function mergeAttrsChildren(attrs, ...children) {
//     if (attrs != null && (
//         typeof attrs !== "object" ||
//         attrs.tag != null ||
//         Array.isArray(attrs)
//     )) {
//         return {
//             children: children.length === 0 && Array.isArray(attrs)
//                 ? attrs
//                 : [attrs, ...children]
//         }
//     }
//
//     if (children.length === 1 && Array.isArray(children[0])) {
//         children = children[0]
//     }
//
//     return attrs != null && Array.isArray(attrs.children)
//         ? attrs
//         : {...attrs, children}
// }
export function mergeAttrsChildren() {
	// Let's short-circuit this early. It also prevents a potential
	// out-of-bounds `arguments` read, which helps some engines.
	if (arguments.length < 2) return {children: []}

	// This also safeguards against if this is parsed in sloppy mode for
	// whatever reason (like if this is in ES5)
	var attrs = arguments[1], children, replacement

	// 0 = is attrs, 1 = missing, 2 = is child, 3 = is fragment
	var firstType = 1

	if (attrs == null) firstType = 0
	else if (typeof attrs !== "object" || Array.isArray(attrs)) firstType = 2
	else if (attrs.tag != null) firstType = 0
	else if (Array.isArray(attrs.children)) return attrs
	else firstType = 3

	if (arguments.length === 2) {
		if (firstType & 2) return {children: firstType & 1 ? attrs : [attrs]}
		children = []
	} else {
		var start = firstType & 2 ? 1 : 2
		if (arguments.length === start + 1) {
			children = arguments[start]
			if (!Array.isArray(children)) children = [children]
		} else {
			children = []
			while (start < arguments.length) {
				children.push(arguments[start++])
			}
		}
	}

	if (firstType !== 0) return {children: children}
	replacement = {}
	assign(replacement, attrs)
	replacement.children = children
	return replacement
}
