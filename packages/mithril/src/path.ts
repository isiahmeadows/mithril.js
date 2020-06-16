import {assign, eachKey} from "./internal/util"
import * as KeyMap from "./internal/key-map"

// These all need to be reasonably fast as they all could be used in a
// `router.linkTo` parameter in the view.

type PathValue = APIOptional<
    string | number | boolean | ParamsObject | PathArray
>
interface ParamsObject { [key: string]: PathValue }
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface PathArray extends Array<PathValue> {}

function destructure(
    parts: Array<Maybe<string>>,
    objectIndices: KeyMap.T<string, number>,
    path: string,
    value: PathValue
) {
    if (value != null && value !== false) {
        const index = KeyMap.get(objectIndices, path)
        // Append to arrays, overwrite everything else.
        if (index !== void 0) parts[index] = void 0
        if (typeof value !== "object") {
            parts.push(
                encodeURIComponent(path) + (
                    value === true ? "" : "=" + encodeURIComponent(value)
                )
            )
        } else if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                destructure(parts, objectIndices, `${path}[]`, value[i])
            }
        } else {
            eachKey(value, (value, key) => {
                destructure(parts, objectIndices, `${path}[${key}]`, value)
            })
        }
    }
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
    const resolved = path.replace(/:(?:(:)|([^\/\.-]+)(\.{3})?)/g,
        (m, isColon, key, variadic) => {
            // For `::`
            if (isColon) return ":"
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
    const newHashIndex = resolved.indexOf("#")
    const newQueryEnd = newHashIndex < 0 ? resolved.length : newHashIndex
    let prefix = ""
    let newPathEnd = resolved.indexOf("?")

    if (newPathEnd < 0) newPathEnd = newQueryEnd
    else prefix = resolved.slice(newPathEnd, newQueryEnd) + "&"

    const parts = (
        (prefix + template.slice(queryIndex + 1, queryEnd)).split("&")
    ) as Array<Maybe<string>>

    const objectIndices = new KeyMap.T<string, number>()

    for (let i = 0; i < parts.length; i++) {
        // Only `destructure` can reset entries to `undefined`, so this is okay.
        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        let index = parts[i]!.indexOf("=")
        if (index < 0) index = parts[i]!.length
        const key = decodeURIComponent(parts[i]!.slice(0, index))
        /* eslint-enable @typescript-eslint/no-non-null-assertion */

        // Append to arrays, overwrite everything else.
        if (key.slice(-2) !== "[]") KeyMap.set(objectIndices, key, i)
    }

    eachKey(query, (value, key) => {
        destructure(parts, objectIndices, key, value)
    })

    let result = resolved.slice(0, newPathEnd)

    for (let i = 0; i < parts.length; i++) {
        if (parts[i] !== void 0) {
            // TypeScript isn't narrowing like it should.
            /* eslint-disable @typescript-eslint/no-non-null-assertion */
            result += "?" + parts[i]!
            while (++i < parts.length) {
                if (parts[i] !== void 0) result += "&" + parts[i]!
            }
            /* eslint-enable @typescript-eslint/no-non-null-assertion */
            break
        }
    }

    // Prefer the new hash over the old hash
    if (newHashIndex >= 0) result += resolved.slice(newHashIndex)
    else if (hashIndex >= 0) result += template.slice(hashIndex)
    // Hint for engine to finally flatten.
    return result.concat()
}
