import {assign, eachKey} from "./internal/util"

// These all need to be reasonably fast as they all could be used in a
// `Router.linkTo` parameter in the view.

type PathValue = string | number | boolean | ParamsObject | PathArray
interface ParamsObject { [key: string]: PathValue }
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface PathArray extends Array<PathValue> {}

function destructure(
    parts: (string | null)[],
    skip: {[path: string]: number},
    path: string,
    value: PathValue
) {
    if (value != null && value !== false) {
        const index = skip[path]
        if (index != null) parts[index] = null
        if (typeof value !== "object") {
            parts.push(
                encodeURIComponent(path) + (
                    value === true ? "" : "=" + encodeURIComponent(value)
                )
            )
        } else if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                destructure(parts, skip, `${path}[]`, value[i])
            }
        } else {
            eachKey(value, (value, key) => {
                destructure(parts, skip, `${path}[${key}]`, value)
            })
        }
    }
}

function buildQuery(query: ParamsObject, prefix: string): string {
    const parts = prefix.split("&")
    const skip = Object.create(null) as {[path: string]: number}

    for (let i = 0; i < parts.length; i++) {
        let index = parts[i].indexOf("=")
        if (index < 0) index = parts[i].length
        const key = decodeURIComponent(parts[i].slice(0, index))
        // Append to arrays, don't overwrite them.
        if (key.slice(-2) !== "[]") skip[key] = i
    }

    eachKey(query, (value, key) => {
        destructure(parts, skip, key, value)
    })

    let count = 0
    for (let i = 0; i < parts.length; i++) {
        if (parts[i] != null) parts[count++] = parts[i]
    }
    parts.length = count

    return parts.join("&")
}

// Returns `path` from `template` + `params`
export function p(template: string, params: ParamsObject): string {
    if ((/:([^\/\.-]+)(\.{3})?:/).test(template)) {
        throw new SyntaxError("Template parameter names *must* be separated")
    }
    if (params == null) return template
    const queryIndex = template.indexOf("?")
    const hashIndex = template.indexOf("#")
    const queryEnd = hashIndex < 0 ? template.length : hashIndex
    const pathEnd = queryIndex < 0 ? queryEnd : queryIndex
    const path = template.slice(0, pathEnd)
    const query = Object.create(null) as {[key: string]: ParamsObject[string]}

    assign(query, params)

    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    const resolved = path.replace(/:([^\/\.-]+)(\.{3})?/g,
        (m, key, variadic) => {
            delete query[key]
            // If no such parameter exists, don't interpolate it.
            if (params[key] == null) return m
            // Escape normal parameters, but not variadic ones.
            return variadic
                ? `${params[key]}`
                : encodeURIComponent(`${params[key]}`)
        }
    )
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */

    // In case the template substitution adds new query/hash parameters.
    const newQueryIndex = resolved.indexOf("?")
    const newHashIndex = resolved.indexOf("#")
    const newQueryEnd = newHashIndex < 0 ? resolved.length : newHashIndex
    const newPathEnd = newQueryIndex < 0 ? newQueryEnd : newQueryIndex

    const prefix = newQueryIndex >= 0
        ? resolved.slice(newQueryIndex, newQueryEnd)
        : ""
    const querystring = buildQuery(query,
        prefix + (newQueryIndex >= 0 ? "&" : "") +
        template.slice(queryIndex + 1, queryEnd)
    )

    let result = resolved.slice(0, newPathEnd)
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
