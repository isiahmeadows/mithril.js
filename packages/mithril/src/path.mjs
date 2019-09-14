import {assign, forEach} from "./internal/util.mjs"

// These all need to be reasonably fast as they all could be used in a
// `Router.linkTo` parameter in the view.

function destructure(parts, skip, path, value) {
    if (value != null && value !== false) {
        var index = skip[path]
        if (index != null) parts[index] = null
        if (typeof value !== "object") {
            parts.push(
                encodeURIComponent(path) + (
                    value === true ? "" : "=" + encodeURIComponent(value)
                )
            )
        } else if (Array.isArray(value)) {
            for (var i = 0; i < value.length; i++) {
                destructure(parts, skip, value[i], path + "[]")
            }
        } else {
            forEach(value, function (value, key) {
                destructure(parts, skip, value, path + "[" + key + "]")
            })
        }
    }
}

function buildQuery(query, prefix) {
    var parts = prefix.split("&")
    var skip = Object.create(null)

    for (var i = 0; i < parts.length; i++) {
        var index = parts[i].indexOf("=")
        if (index < 0) index = parts[i].length
        var key = decodeURIComponent(parts[i].slice(0, index))
        // Append to arrays, don't overwrite them.
        if (key.slice(-2) !== "[]") skip[key] = i
    }

    forEach(query, function (value, key) {
        destructure(parts, skip, value, key)
    })

    var count = 0
    for (var i = 0; i < parts.length; i++) {
        if (parts[i] != null) parts[count++] = parts[i]
    }
    parts.length = count

    return parts.join("&")
}

// Returns `path` from `template` + `params`
export function p(template, params) {
    if ((/:([^\/\.-]+)(\.{3})?:/).test(template)) {
        throw new SyntaxError("Template parameter names *must* be separated")
    }
    if (params == null) return template
    var queryIndex = template.indexOf("?")
    var hashIndex = template.indexOf("#")
    var queryEnd = hashIndex < 0 ? template.length : hashIndex
    var pathEnd = queryIndex < 0 ? queryEnd : queryIndex
    var path = template.slice(0, pathEnd)
    var query = {}

    assign(query, params)

    var resolved = path.replace(/:([^\/\.-]+)(\.{3})?/g, function(m, key, variadic) {
        delete query[key]
        // If no such parameter exists, don't interpolate it.
        if (params[key] == null) return m
        // Escape normal parameters, but not variadic ones.
        return variadic ? params[key] : encodeURIComponent(String(params[key]))
    })

    // In case the template substitution adds new query/hash parameters.
    var newQueryIndex = resolved.indexOf("?")
    var newHashIndex = resolved.indexOf("#")
    var newQueryEnd = newHashIndex < 0 ? resolved.length : newHashIndex
    var newPathEnd = newQueryIndex < 0 ? newQueryEnd : newQueryIndex

    var prefix = newQueryIndex >= 0
        ? resolved.slice(newQueryIndex, newQueryEnd)
        : ""
    var querystring = buildQuery(query,
        prefix + (newQueryIndex >= 0 ? "&" : "") +
        template.slice(queryIndex + 1, queryEnd)
    )

    var result = resolved.slice(0, newPathEnd)
    if (querystring) result += "?" + querystring
    // Prefer the new hash over the old hash
    if (newHashIndex >= 0) result += resolved.slice(newHashIndex)
    else if (hashIndex >= 0) result += template.slice(hashIndex)
    return result
}

export function path() {
    // TODO: implement this tag.
    // Note: This will have to be a simple state machine to be efficient,
    // because of all the indirection.
    // States:
    // - "path" - is path
    // - "query" - is query
    // - "hash" - is hash
}
