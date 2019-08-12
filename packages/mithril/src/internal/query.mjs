import {forEach} from "./internal/util.mjs"

// This needs to be reasonably fast as it could be used in a `Router.linkTo`
// parameter in the view.
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

// This needs to be reasonably fast as it could be used in a `Router.linkTo`
// parameter in the view.
export function buildQuery(query, prefix) {
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
