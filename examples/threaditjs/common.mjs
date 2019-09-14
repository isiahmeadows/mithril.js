// API calls
T.time("Setup")

const requestJson = (opts, method = "GET") => async (strs, ...args) => {
    const url = T.apiUrl +
        args.map(encodeURIComponent).map((x, i) => strs[i] + x).join("") +
        strs[strs.length - 1]
    const response = await fetch(url, {...opts, method})
    if (response.ok) return response.json()
    const err = new Error(`${response.status} ${response.statusText}`)
    err.code = response.status
    throw err
}

export const api = {
    async home(opts) {
        T.timeEnd("Setup")
        return requestJson(opts)`/threads`
    },
    async thread(id, opts) {
        T.timeEnd("Setup")
        return T.transformResponse(await requestJson(opts)`/threads/${id}`)
    },
    async newThread(text, opts) {
        return requestJson(opts, "POST")`/threads/create?text=${text}`
    },
    async newComment(text, id, opts) {
        return requestJson(opts, "POST")`/comments/create?text=${text}&parent=${id}`
    },
}

// shared
export const demoSource = (name) =>
    `https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/${name}`
