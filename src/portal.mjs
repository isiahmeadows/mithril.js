import {PortalGet, PortalSet, m} from "./m.js"

export function create(token = {}) {
	return {
		Get: (attrs) => m(PortalGet, {...attrs, token}),
		Set: (attrs) => m(PortalSet, {...attrs, token}),
	}
}

function doGet(portals, children) {
	const attrs = {
		token: [],
		default: [],
	}

	for (const portal of portals) {
		if (Array.isArray(portal)) {
			attrs.token.push(portal[0].token)
			attrs.default.push(portal[1])
		} else {
			attrs.token.push(portal.token)
			attrs.default.push(undefined)
		}
	}

	return m(PortalGet, portals, children)
}

function zipObject(keys, values) {
	const object = {}
	for (let i = 0; i < keys.length; i++) object[keys[i]] = values[i]
	return object
}

export function Get({portals, children}) {
	if (Array.isArray(portals)) return doGet(portals, children)
	const keys = Object.keys(portals)
	return doGet(Object.values(portals),
		(values) => children(zipObject(keys, values))
	)
}

export function Set({portals, children}) {
	const attrs = {
		token: [],
		value: [],
	}
	for (const [t, v] of portals) {
		attrs.token.push(t.token)
		attrs.value.push(v)
	}
	return m(PortalSet, attrs, children)
}

function doUpdate(portals, children, current, zipValues) {
	const attrs = {
		token: [],
		default: [],
		value: [],
	}

	for (const [t, d, v] of portals) {
		attrs.token.push(t.token)
		attrs.default.push(d)
		attrs.value.push(v)
	}

	return m(PortalGet, attrs, (prevValues) =>
		m(PortalSet, attrs, children(current, zipValues(prevValues)))
	)
}

export function Update({portals, children}) {
	if (Array.isArray(portals)) {
		return doUpdate(portals, children, portals, (prevValues) => prevValues)
	} else {
		const keys = Object.keys(portals)
		return doUpdate(
			Object.values(portals), children, portals,
			(prevValues) => zipObject(keys, prevValues)
		)
	}
}
