import {forEach} from "./internal/util.mjs"

function hasHeader(opts, name) {
    for (var key in opts.headers) {
        if ({}.hasOwnProperty.call(opts.headers, key) && name.test(key)) {
            return true
        }
    }
    return false
}

export function request(url, opts) {
    if (opts == null) opts = {}
    return new Promise(function (resolve, reject) {
        // eslint-disable-next-line no-undef
        var localWindow = opts.window || window
        var method = opts.method != null ? opts.method.toUpperCase() : "GET"
        var body = opts.body
        var signal = opts.signal
        var assumeJSON =
            opts.serialize == null &&
            !(body instanceof localWindow.FormData)
        var responseType = opts.responseType ||
            (opts.extract != null ? "" : "json")

        var xhr = new localWindow.XMLHttpRequest()

        function onAbort() {
            signal.removeEventListener("abort", onAbort, false)
            xhr.abort()
        }

        signal.addEventListener("abort", onAbort, false)

        xhr.open(
            method, url,
            opts.async == null || opts.async,
            opts.user, opts.password
        )

        xhr.withCredentials = opts.withCredentials
        xhr.timeout = opts.timeout
        xhr.onprogress = opts.onprogress
        xhr.responseType = responseType

        xhr.onreadystatechange = function() {
            // Note: `xhr.abort()` sets `xhr.readyState` to `0`
            if (xhr.readyState === 4) {
                signal.removeEventListener("abort", onAbort, false)
                try {
                    var success = (xhr.status >= 200 && xhr.status < 300) ||
                        xhr.status === 304 || (/^file:\/\//i).test(url)
                    // When the response type isn't "" or "text",
                    // `xhr.responseText` is the wrong thing to use.
                    // Browsers do the right thing and throw here, and we
                    // should honor that and do the right thing by
                    // preferring `xhr.response` where possible/practical.
                    var response = xhr.response, message

                    if (responseType === "json") {
                        // For IE and Edge, which don't implement
                        // `responseType: "json"`.
                        if (!xhr.responseType && opts.extract == null) {
                            response = JSON.parse(xhr.responseText)
                        }
                    } else if (!responseType || responseType === "text") {
                        // Only use this default if it's text. If a parsed
                        // document is needed on old IE and friends (all
                        // unsupported), the user should use a custom
                        // `config` instead. They're already using this at
                        // their own risk.
                        if (response == null) response = xhr.responseText
                    }

                    if (opts.extract != null) {
                        response = opts.extract(xhr, opts)
                        success = true
                    } else if (opts.deserialize != null) {
                        response = opts.deserialize(response)
                    }

                    if (success) {
                        resolve(response)
                    } else {
                        try {
                            message = xhr.responseText
                        } catch (e) {
                            message = response
                        }
                        var error = new Error(message)
                        error.code = xhr.status
                        error.response = response
                        // So IE gets correct stacks here.
                        throw error
                    }
                } catch (e) {
                    reject(e)
                }
            }
        }

        if (assumeJSON && body != null && !hasHeader(opts, /^content-type$/i)) {
            xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8")
        }

        if (opts.deserialize == null && !hasHeader(opts, /^accept$/i)) {
            xhr.setRequestHeader("Accept", "application/json, text/*")
        }

        forEach(opts.headers, function (value, key) {
            xhr.setRequestHeader(key, value)
        })

        if (opts.config != null) opts.config(xhr)

        if (body == null) xhr.send()
        else if (opts.serialize != null) xhr.send(opts.serialize(body))
        else if (body instanceof localWindow.FormData) xhr.send(body)
        else xhr.send(JSON.stringify(body))
    })
}
