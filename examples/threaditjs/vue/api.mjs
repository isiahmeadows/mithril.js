const requestJSON = (opts, method = "GET") => async (strs, ...args) => {
    const url = T.apiUrl +
        args.map(encodeURIComponent).map((x, i) => strs[i] + x).join("") +
        strs[strs.length - 1]
    const response = await fetch(url, {...opts, method})
    if (response.ok) return response.json()
    const err = new Error(`${response.status} ${response.statusText}`)
    err.code = response.status
    throw err
}

export async function home(opts) {
    T.timeEnd("Setup")
    return requestJSON(opts)`/threads`
}

export async function thread(id, opts) {
    T.timeEnd("Setup")
    return T.transformResponse(await requestJSON(opts)`/threads/${id}`)
}

export async function newThread(text, opts) {
    return requestJSON(opts, "POST")`/threads/create?text=${text}`
}

export async function newComment(text, id, opts) {
    return requestJSON(opts, "POST")`/comments/create?text=${text}&parent=${id}`
}
