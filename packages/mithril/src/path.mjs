import {assign} from "./internal/util.mjs"
import {buildQuery} from "./internal/query.mjs"

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
