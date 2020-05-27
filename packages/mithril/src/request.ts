import {eachKey} from "./internal/util"
import {
    Window, XMLHttpRequest, AbortSignal, XMLHttpRequestResponseType,
    XMLHttpRequestReadyState, XMLHttpRequestBodyObject, FormData,
    Event, ProgressEvent, EventListenerObject
} from "./internal/dom"
import {EventListenerExternal} from "./internal/vnode"

// https://github.com/microsoft/TypeScript/issues/37802 for 99% of these
/* eslint-disable @typescript-eslint/no-non-null-assertion */

type Headers = {[key: string]: string}

interface RequestHead {
    status: number
    statusText: string
    headers: Headers
}

interface Progress {
    lengthComputable: boolean
    loaded: number
    total: number
}

interface EventsMap {
    progress: Progress
    headersReceived: RequestHead
}

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
    headers?: APIOptional<Headers>
    on?: APIOptional<{
        [P in keyof EventsMap]?: APIOptional<
            EventListenerExternal<EventsMap[P]>
        >
    }>
    serialize?(data: Polymorphic): string | FormData
    deserialize?(
        response: Polymorphic,
        headers: RequestHead,
        url: string
    ): Await<T>
}

interface ResponseError extends Error {
    code: number
    response: Polymorphic
}

// Not exported and not declared globally on purpose.
declare const window: Window

export {request as default}
const request: {
    <T extends Polymorphic>(
        url: string,
        opts?: APIOptional<RequestOptions<T>>
    ): Promise<T>
    TIMEOUT: ResponseError
    deserialize: RequestOptions<Polymorphic>["deserialize"]
    error(
        message: string, code: number, response: Polymorphic
    ): ResponseError
} = /*@__PURE__*/ (() => {
function hasHeader<T extends Polymorphic>(opts: RequestOptions<T>, re: RegExp) {
    return Object.keys(opts.headers!).some((key) => re.test(key))
}

request.error = (
    message: string, code: number, response: Polymorphic
): ResponseError => {
    const error = new Error(message) as ResponseError
    error.code = code
    error.response = response
    // So IE gets correct stacks here.
    return error
}

request.deserialize = (
    response: Polymorphic,
    head: RequestHead,
    url: string
): Polymorphic => {
    if (
        (head.status >= 200 && head.status < 300) || head.status === 304 ||
            (/^file:\/\//i).test(url)
    ) return response
    // Thrown so IE gets correct stacks here.
    // Let it get coerced
    throw request.error(
        `Network error: ${head.statusText}`,
        head.status,
        response
    )
}

request.TIMEOUT = request.error("Request timed out.", 0, null)

function getHead(xhr: XMLHttpRequest): RequestHead {
    const headers = Object.create(null) as Headers
    const pairs = xhr.getAllResponseHeaders().split("\r\n")

    for (let i = 0; i < pairs.length; i++) {
        const index = pairs[i].indexOf(":")
        if (index >= 0) {
            const key = pairs[i].slice(0, index).trim()
            const value = pairs[i].slice(index).trim()
            const existing = headers[key]
            headers[key] = existing != null
                ? `${existing}, ${value}`
                : value
        }
    }

    return {
        status: xhr.status,
        statusText: xhr.statusText,
        headers,
    }
}

interface Handler<T extends Polymorphic> extends EventListenerObject<
        | Event<"readystatechange">
        | Event<"abort">
        | ProgressEvent<"timeout">
        | ProgressEvent<"progress">
    > {
    u: string
    o: RequestOptions<T>
    p: (value: T | PromiseLike<T>) => void
    f: (error: Any) => void
    h: Maybe<(event: RequestHead) => void>
    x: XMLHttpRequest
}

interface HandlerConstructor {
    new <T>(
        url: string,
        opts: RequestOptions<T>,
        resolve: (value: T | PromiseLike<T>) => void,
        reject: (error: Any) => void,
        xhr: XMLHttpRequest,
    ): Handler<T>
    prototype: Handler<Polymorphic>
}

function bail<T>(handler: Handler<T>, error: Any) {
    handler.o.signal!.removeEventListener("abort", handler, false)
    handler.x.abort()
    handler.f(error)
}

function emit<T, N extends keyof EventsMap>(
    handler: Handler<T>,
    name: N,
    event: EventsMap[N]
) {
    // Abort the request and error out on error. We have no idea if the
    // subsequent logic will succeed or not.
    try {
        const on = handler.o.on
        if (on == null) return
        const receiver = on[name]
        if (receiver == null) return
        let p: Await<void>
        if (typeof receiver === "function") {
            // Not sure why this isn't polymorphically reduced, but okay.
            p = receiver(event as Progress & RequestHead)
        } else {
            // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
            // @ts-ignore https://github.com/microsoft/TypeScript/issues/35866
            p = (0, receiver[1])(
                // Need to downcast the receiver - see comment regarding
                // `EventListener` and `EventListenerExternal` in
                // internal/vnode.ts for why.
                event[receiver[0] as keyof EventsMap[keyof EventsMap]]
            )
        }

        Promise.resolve(p).catch((e) => { bail(handler, e as Any) })
    } catch (e) {
        bail(handler, e as Any)
    }
}

const Handler = function <T>(
    this: Handler<T>,
    url: string,
    opts: RequestOptions<T>,
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (error: Any) => void,
    xhr: XMLHttpRequest,
) {
    this.u = url
    this.o = opts
    this.p = resolve
    this.f = reject
    this.x = xhr
} as Any as HandlerConstructor

Handler.prototype.handleEvent = function (
    this: Handler<Polymorphic>,
    event: (
        | Event<"readystatechange">
        | Event<"abort">
        | ProgressEvent<"timeout">
        | ProgressEvent<"progress">
    )
) {
    // Note: `xhr.abort()` sets `xhr.readyState` to
    // `XMLHttpRequestReadyState.UNSENT`, so it fails the last two checks
    if (event.target === this.o.signal) {
        this.o.signal!.removeEventListener("abort", this, false)
        this.x.abort()
    } else if (event.type === "timeout") {
        this.f(request.TIMEOUT)
    } else if (event.type === "progress") {
        emit(this, "progress", {
            lengthComputable: event.lengthComputable,
            loaded: event.loaded,
            total: event.total,
        })
    } else if (
        this.x.readyState === XMLHttpRequestReadyState.HEADERS_RECEIVED
    ) {
        emit(this, "headersReceived", getHead(this.x))
    } else if (this.x.readyState === XMLHttpRequestReadyState.DONE) {
        if (this.o.signal != null) {
            this.o.signal.removeEventListener("abort", this, false)
        }

        try {
            // When the response type isn't "" or "text",
            // `xhr.responseText` is the wrong thing to use.
            // Browsers do the right thing and throw here, and we
            // should honor that and do the right thing by
            // preferring `xhr.response` where possible/practical.
            let response = this.x.response as Polymorphic
            const inputResponseType = this.o.responseType

            if (inputResponseType == null || inputResponseType === "json") {
                // For IE and pre-Chromium Edge, which don't
                // implement `responseType: "json"`.
                if (!this.x.responseType) {
                    response = JSON.parse(this.x.responseText)
                }
            } else if (
                inputResponseType === "" ||
                inputResponseType === "text"
            ) {
                // Only use this default if it's text. If a parsed
                // document is needed on old IE and friends (all
                // unsupported), the user should only use text and
                // JSON requests. They're already using this at
                // their own risk.
                if (response == null) response = this.x.responseText
            }

            if (this.o.deserialize != null) {
                response = this.o.deserialize(
                    response, getHead(this.x), this.u
                )
            }

            this.p(response)
        } catch (e) {
            this.f(e as Any)
        }
    }
}

function request<T extends Polymorphic>(
    url: string,
    opts?: APIOptional<RequestOptions<T>>
): Promise<T> {
    return new Promise((resolve, reject) => {
        if (opts == null) opts = {} as RequestOptions<T>
        const localWindow: Window = opts.window! || window
        const signal = opts.signal
        const responseType = opts.responseType != null
            ? opts.responseType
            : "json"
        let body = opts.body

        const xhr: Maybe<XMLHttpRequest> = new localWindow.XMLHttpRequest()

        const handler = new Handler(
            url,
            opts,
            resolve,
            reject, xhr
        )

        xhr.responseType = responseType

        if (signal != null) {
            signal.addEventListener("abort", handler, false)
        }

        xhr.open(
            opts.method != null ? opts.method.toUpperCase() : "GET",
            url, true, opts.user, opts.password
        )

        if (opts.withCredentials != null) {
            xhr.withCredentials = opts.withCredentials
        }

        if (opts.timeout != null) {
            xhr.timeout = opts.timeout
            xhr.addEventListener(
                "timeout",
                // The cast is necessary to shut TS up about a type mismatch
                // that doesn't actually exist. (It just can't find the
                // right type.)
                handler as EventListenerObject<
                        ProgressEvent<"timeout">
                    >,
                false
            )
        }

        if (opts.on != null && opts.on.progress != null) {
            xhr.addEventListener(
                "progress",
                // The cast is necessary to shut TS up about a type mismatch
                // that doesn't actually exist. (It just can't find the
                // right type.)
                handler as EventListenerObject<
                        ProgressEvent<"progress">
                    >,
                false
            )
        }

        xhr.addEventListener(
            "readystatechange",
            // The cast is necessary to shut TS up about a type mismatch
            // that doesn't actually exist. (It just can't find the right
            // type.)
            handler as EventListenerObject<Event<"readystatechange">>,
            false
        )

        if (
            opts.serialize == null &&
                !(body instanceof localWindow.FormData) &&
                body != null && !hasHeader(opts, /^content-type$/i)) {
            xhr.setRequestHeader(
                "Content-Type", "application/json; charset=utf-8"
            )
        }

        if (opts.deserialize == null && !hasHeader(opts, /^accept$/i)) {
            xhr.setRequestHeader("Accept", "application/json, text/*")
        }

        eachKey(opts.headers, (value, key) => {
            xhr.setRequestHeader(key, value)
        })

        if (opts.serialize != null) {
            body = opts.serialize(body)
        } else if (!(body instanceof localWindow.FormData)) {
            body = JSON.stringify(body)
        }

        if (body == null) xhr.send()
        else xhr.send(body as XMLHttpRequestBodyObject | FormData)
    })
}

return request
})()
