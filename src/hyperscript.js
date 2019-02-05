"use strict"

var RETAIN    = 0x0000
var TEXT      = 0x0001
var TRUST     = 0x0002
var KEYED     = 0x0003
var COMPONENT = 0x0008
var OTHER     = 0x0209
var FRAGMENT  = 0x020A

var nameMap = Object.create(null)

nameMap.a          = 0x0010
nameMap.abbr       = 0x0011
nameMap.address    = 0x0012
nameMap.area       = 0x0213
nameMap.article    = 0x0014
nameMap.aside      = 0x0015
nameMap.audio      = 0x0016
nameMap.b          = 0x0017
nameMap.base       = 0x0218
nameMap.bdi        = 0x0019
nameMap.bdo        = 0x001A
nameMap.blockquote = 0x001B
nameMap.body       = 0x001C
nameMap.br         = 0x021D
nameMap.button     = 0x001E
nameMap.canvas     = 0x001F
nameMap.caption    = 0x0020
nameMap.cite       = 0x0021
nameMap.code       = 0x0022
nameMap.col        = 0x0223
nameMap.colgroup   = 0x0024
nameMap.data       = 0x0025
nameMap.datalist   = 0x0026
nameMap.dd         = 0x0027
nameMap.del        = 0x0028
nameMap.details    = 0x0029
nameMap.dfn        = 0x002A
nameMap.dialog     = 0x002B
nameMap.div        = 0x002C
nameMap.dl         = 0x002D
nameMap.dt         = 0x002E
nameMap.em         = 0x002F
nameMap.embed      = 0x0230
nameMap.fieldset   = 0x0031
nameMap.figcaption = 0x0032
nameMap.figure     = 0x0033
nameMap.footer     = 0x0034
nameMap.form       = 0x0035
nameMap.h1         = 0x0036
nameMap.h2         = 0x0037
nameMap.h3         = 0x0038
nameMap.h4         = 0x0039
nameMap.h5         = 0x003A
nameMap.h6         = 0x003B
nameMap.head       = 0x003C
nameMap.header     = 0x003D
nameMap.hgroup     = 0x003E
nameMap.hr         = 0x023F
nameMap.html       = 0x0040
nameMap.i          = 0x0041
nameMap.iframe     = 0x0042
nameMap.img        = 0x0243
nameMap.input      = 0x0244
nameMap.ins        = 0x0045
nameMap.kbd        = 0x0046
nameMap.label      = 0x0047
nameMap.legend     = 0x0048
nameMap.li         = 0x0049
nameMap.link       = 0x024A
nameMap.main       = 0x004B
nameMap.map        = 0x004C
nameMap.mark       = 0x004D
nameMap.menu       = 0x004E
nameMap.meta       = 0x024F
nameMap.meter      = 0x0050
nameMap.nav        = 0x0051
nameMap.noscript   = 0x0052
nameMap.object     = 0x0053
nameMap.ol         = 0x0054
nameMap.optgroup   = 0x0055
nameMap.option     = 0x0056
nameMap.output     = 0x0057
nameMap.p          = 0x0058
nameMap.param      = 0x0259
nameMap.picture    = 0x005A
nameMap.pre        = 0x005B
nameMap.progress   = 0x005C
nameMap.q          = 0x005D
nameMap.rp         = 0x005E
nameMap.rt         = 0x005F
nameMap.ruby       = 0x0060
nameMap.s          = 0x0061
nameMap.samp       = 0x0062
nameMap.script     = 0x0063
nameMap.section    = 0x0064
nameMap.select     = 0x0065
nameMap.slot       = 0x0066
nameMap.small      = 0x0067
nameMap.source     = 0x0268
nameMap.span       = 0x0069
nameMap.strong     = 0x006A
nameMap.style      = 0x006B
nameMap.sub        = 0x006C
nameMap.summary    = 0x006D
nameMap.sup        = 0x006E
nameMap.table      = 0x006F
nameMap.tbody      = 0x0070
nameMap.td         = 0x0071
nameMap.template   = 0x0072
nameMap.textarea   = 0x0073
nameMap.tfoot      = 0x0074
nameMap.th         = 0x0075
nameMap.thead      = 0x0076
nameMap.time       = 0x0077
nameMap.title      = 0x0078
nameMap.tr         = 0x0079
nameMap.track      = 0x027A
nameMap.u          = 0x007B
nameMap.ul         = 0x007C
nameMap.var        = 0x007D
nameMap.video      = 0x007E
nameMap.wbr        = 0x027F

function create(mask, tag, attrs, children) {
	return {mask: mask, tag: tag, attrs: attrs, children: children}
}

var selectorParser = /(?:(^|#|\.)([^#\.\[\]]+))|(\[(.+?)(?:\s*=\s*("|'|)((?:\\["'\]]|.)*?)\5)?\])/g
var selectorCache = {}
var hasOwn = {}.hasOwnProperty
var assign = Object.assign || function (target, source) {
	for (var key in source) {
		if (hasOwn.call(source, key)) target[key] = source[key]
	}
}

function compileSelector(selector) {
	var match, tag = "div", classes = [], attrs = {}
	while (match = selectorParser.exec(selector)) {
		var type = match[1], value = match[2]
		if (type === "" && value !== "") tag = value
		else if (type === "#") attrs.id = value
		else if (type === ".") classes.push(value)
		else if (match[3][0] === "[") {
			var attrValue = match[6]
			if (attrValue) {
				attrValue = attrValue
					.replace(/\\(["'])/g, "$1")
					.replace(/\\\\/g, "\\")
			}
			if (match[4] === "class") classes.push(attrValue)
			else attrs[match[4]] = attrValue === "" ? attrValue : attrValue || true
		}
	}
	if (classes.length) attrs.className = classes.join(" ")
	if (!Object.keys(attrs).length) attrs = null
	return selectorCache[selector] = {tag: tag, attrs: attrs}
}

function execSelector(state, attrs, children, mask) {
	if (state.attrs != null) {
		if (attrs == null) {
			attrs = state.attrs
		} else {
			var className = hasOwn.call(attrs, "class")
				? attrs.class
				: attrs.className
			var newAttrs = {}

			assign(newAttrs, state.attrs)
			assign(newAttrs, attrs)

			if (className != null && state.attrs.className != null) {
				newAttrs.className = state.attrs.className + " " + className
				newAttrs.class = null
			}

			attrs = newAttrs
		}
	}

	var nameMask = nameMap[state.tag]
	var tag = typeof attrs.is === "string" ? attrs.is : undefined

	if (nameMask == null) {
		nameMask = OTHER
		if (state.tag.indexOf("-") >= 0 || tag != null) mask |= 0x0100
		tag = state.tag
	}

	return create(mask | nameMask, tag, attrs, children)
}

function normalizeChildren(input) {
	var children = []

	for (var i = 0; i < input.length; i++) {
		var node = input[i]
		var mask = 0
		if (node === false) return null
		if (node != null && typeof node !== "object") {
			node += ""
			children[i] = create(
				TEXT | 0x1000 & -!node,
				undefined, undefined, node
			)
		} else if (Array.isArray(node)) {
			children[i] = create(
				FRAGMENT |
				0x1000 & -(children.length === 0) |
				0x2000 & (children.length === 1),
				undefined, undefined, normalizeChildren(node)
			)
		} else {
			children[i] = node
		}
	}
	return children
}

var retainConstant = create(RETAIN, undefined, undefined, undefined)

function m(selector) {
	if (selector == null || typeof selector !== "string" && typeof selector !== "function" && typeof selector.view !== "function") {
		throw Error("The selector must be either a string or a component.");
	}

	var attrs = arguments[1], start = 2, children

	if (selector === RETAIN) {
		if (attrs != null) {
			if (attrs.key != null) selector |= 0x0400
			if (attrs.ref != null) selector |= 0x0800
		}
		if (selector === 0) return retainConstant
		return create(selector, attrs, undefined, undefined)
	}

	var result

	if (attrs != null) {
		if (typeof attrs !== "object" || attrs.tag != null || Array.isArray(attrs)) {
			attrs = undefined
			start = 1
		} else {
			children = attrs.children
		}
	}

	if (selector === TEXT || selector === TRUST) {
		if (Array.isArray(children)) {
			children = children.join("")
		} else if (arguments.length === start + 1) {
			children = arguments[start]
			children = "" + (Array.isArray(children) ? children[0] : children)
		} else {
			children = ""
			while (start < arguments.length) children += arguments[start++]
		}
		if (!children) selector |= 0x1000
		result = create(selector, undefined, attrs, children)
	} else {
		var mask = 0
		if (!Array.isArray(children)) {
			if (arguments.length === start + 1) {
				children = arguments[start]
				if (!Array.isArray(children)) children = [children]
			} else {
				children = []
				while (start < arguments.length) children.push(arguments[start++])
			}
		}
		if (children.length === 0) mask |= 0x1000
		if (children.length === 0) mask |= 0x2000
		if (typeof selector !== "function") {
			children = normalizeChildren(children)
		}

		if (typeof selector === "number") {
			result = create(selector, undefined, attrs, children)
		} else if (typeof selector === "string") {
			result = execSelector(selectorCache[selector] || compileSelector(selector), attrs, children, mask)
		} else {
			result = create(COMPONENT | mask, selector, attrs, children)
		}
	}

	if (result.attrs != null) {
		if (result.attrs.key != null) result.mask |= 0x0400
		if (result.attrs.ref != null) result.mask |= 0x0800
	}

	return result
}

exports.m = m
exports.create = create
exports.retain = RETAIN
exports.text = TEXT
exports.trust = TRUST
exports.keyed = KEYED
exports.fragment = FRAGMENT
