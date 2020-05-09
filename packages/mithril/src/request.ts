import {eachKey, hasOwn} from "./internal/util"
import {
    Window, XMLHttpRequest, AbortSignal, XMLHttpRequestResponseType,
    XMLHttpRequestReadyState, XMLHttpRequestBodyObject, FormData
} from "./internal/dom"

interface RequestOptions<T extends Polymorphic> {
    window?: APIOptional<Window>
    method?: APIOptional<string>
    body?: Any
    signal?: APIOptional<AbortSignal>
    responseType?: APIOptional<XMLHttpRequestResponseType>
    user?: APIOptional<string>
    password?: APIOptional<string>
    withCredentials?: APIOptional<boolean>
    timeout?: APIOptional<number>
    headers?: APIOptional<{[name: string]: string}>
    on?: {
        progress?: APIOptional<XMLHttpRequest["onprogress"]>
    }
    extract?: APIOptional<
        (xhr: XMLHttpRequest, opts: this, url: string) => Await<T>
    >
    serialize?: APIOptional<(data: Polymorphic) => string | FormData>
    deserialize?: APIOptional<(response: Polymorphic) => T>
    config?: APIOptional<(xhr: XMLHttpRequest) => void>
}

interface ResponseError extends Error {
    code: number
    response: Polymorphic
}

function hasHeader<T extends Polymorphic>(
    opts: RequestOptions<T>, name: RegExp
) {
    for (const key in opts.headers) {
        if (hasOwn.call(opts.headers, key) && name.test(key)) {
            return true
        }
    }
    return false
}

function makeResponseError(message: string, code: number, response: Polymorphic) {
    const error = new Error(message as string) as ResponseError
    error.code = code
    error.response = response
    // So IE gets correct stacks here.
    return error
}

export function extract<T extends Polymorphic>(
    xhr: XMLHttpRequest, opts: RequestOptions<T>, url: string
): T {
    const success = (xhr.status >= 200 && xhr.status < 300) ||
        xhr.status === 304 || (/^file:\/\//i).test(url)
    // When the response type isn't "" or "text", `xhr.responseText` is the
    // wrong thing to use. Browsers do the right thing and throw here, and we
    // should honor that and do the right thing by preferring `xhr.response`
    // where possible/practical.
    let response = xhr.response as Polymorphic

    if (opts.responseType == null || opts.responseType === "json") {
        // For IE and Edge, which don't implement
        // `responseType: "json"`.
        if (!xhr.responseType) response = JSON.parse(xhr.responseText)
    } else if (opts.responseType === "" || opts.responseType === "text") {
        // Only use this default if it's text. If a parsed document is needed on
        // old IE and friends (all unsupported), the user should use a custom
        // `config` instead. They're already using this at their own risk.
        if (response == null) response = xhr.responseText
    }

    if (opts.deserialize != null) {
        response = opts.deserialize(response)
    }
    if (success) return response as T
    let message = response
    try { message = xhr.responseText } catch (e) { /* ignore */ }
    // Thrown so IE gets correct stacks here.
    // Let it get coerced
    throw makeResponseError(message as string, xhr.status, response)
}

// Not exported and not declared globally on purpose.
declare const window: Window

export const request: {
    <T extends Polymorphic>(
        url: string,
        opts?: APIOptional<RequestOptions<T>>
    ): Promise<T>
    TIMEOUT: ResponseError
} = /*@__PURE__*/ (() => {
    request.TIMEOUT = makeResponseError("Request timed out.", 0, null)
    return request
    function request<T extends Polymorphic>(
        url: string,
        opts?: APIOptional<RequestOptions<T>>
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            if (opts == null) opts = {} as RequestOptions<T>
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const localWindow: Window = (opts.window! || window)
            const method = opts.method != null ? opts.method.toUpperCase() : "GET"
            let body = opts.body
            const signal = opts.signal
            const assumeJSON =
                opts.serialize == null &&
                !(body instanceof localWindow.FormData)
            const responseType = opts.responseType || "json"
            const reallyExtract = opts.extract || extract

            let xhr: Maybe<XMLHttpRequest> = new localWindow.XMLHttpRequest()

            function onAbort() {
                signal?.removeEventListener("abort", onAbort, false)
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                xhr!.abort()
                xhr = undefined
            }

            signal?.addEventListener("abort", onAbort, false)

            xhr.open(method, url, true, opts.user, opts.password)

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            xhr.withCredentials = opts.withCredentials!
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            xhr.timeout = opts.timeout!
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            if (opts.on != null) xhr.onprogress = opts.on.progress!
            xhr.ontimeout = () => {
                if (xhr != null) {
                    xhr = undefined
                    reject(request.TIMEOUT)
                }
            }
            xhr.responseType = responseType

            xhr.onreadystatechange = () => {
                // Note: `xhr.abort()` sets `xhr.readyState` to `0`
                if (
                    xhr != null &&
                    xhr.readyState === XMLHttpRequestReadyState.DONE
                ) {
                    signal?.removeEventListener("abort", onAbort, false)
                    try {
                        resolve(
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            reallyExtract(xhr, opts!, url) as T | PromiseLike<T>
                        )
                    } catch (e) {
                        reject(e as Any)
                    }
                }
            }

            if (assumeJSON && body != null && !hasHeader(opts, /^content-type$/i)) {
                xhr.setRequestHeader(
                    "Content-Type", "application/json; charset=utf-8"
                )
            }

            if (opts.deserialize == null && !hasHeader(opts, /^accept$/i)) {
                xhr.setRequestHeader("Accept", "application/json, text/*")
            }

            eachKey(opts.headers, (value, key) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                xhr!.setRequestHeader(key, value)
            })

            if (opts.config != null) opts.config(xhr)

            if (opts.serialize != null) {
                body = opts.serialize(body)
            } else if (!(body instanceof localWindow.FormData)) {
                body = JSON.stringify(body)
            }

            if (body == null) xhr.send()
            else xhr.send(body as XMLHttpRequestBodyObject | FormData)
        })
    }
})()
