import {request, p} from "mithril"

export async function home(opts) {
    T.timeEnd("Setup")
    return request("/threads", opts)
}

export async function thread(id, opts) {
    T.timeEnd("Setup")
    return T.transformResponse(
        await request(p("/threads/:id", {id}), opts)
    )
}

export async function newThread(text, opts) {
    return request(p("/threads/create", {text}), {method: "POST", ...opts})
}

export async function newComment(text, id, opts) {
    return request(
        p("/threads/create", {text, parent}),
        {method: "POST", ...opts}
    )
}
