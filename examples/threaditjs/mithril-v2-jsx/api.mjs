import m from "mithril"

const request = (url, {signal, ...opts}) =>
    m.request(url, {...opts, config: xhr => {
        if (signal) signal.onabort = () => xhr.abort()
    }})

export async function home(opts) {
    T.timeEnd("Setup")
    return request("/threads", opts)
}

export async function thread(id, opts) {
    T.timeEnd("Setup")
    return T.transformResponse(
        await request("/threads/:id", {params: {id}, ...opts})
    )
}

export async function newThread(text, opts) {
    return request("/threads/create", {
        method: "POST", params: {text}, ...opts,
    })
}

export async function newComment(text, id, opts) {
    return request("/threads/create", {
        method: "POST", params: {text, parent}, ...opts,
    })
}
