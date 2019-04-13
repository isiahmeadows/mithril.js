// Common stuff for all the ThreaditJS examples
T.time("Setup")

// API calls
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

// For just Mithril's redesign, it'd look more like this:
// export const api = {
// 	async home({signal} = {}) {
// 		T.timeEnd("Setup")
// 		return request("/threads", {signal})
// 	},
// 	async thread(id, {signal} = {}) {
// 		T.timeEnd("Setup")
// 		return T.transformResponse(
// 			await request(p("/threads/:id", {id}), {signal})
// 		)
// 	},
// 	async newThread(text, {signal} = {}) {
// 		return request(p("/threads/create", {text}), {signal, method: "POST"})
// 	},
// 	async newComment(text, id, {signal} = {}) {
// 		return request(p("/comments/create", {text, id}), {signal, method: "POST"})
// 	},
// }

// shared
export const demoSource = (name) =>
	`https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/threaditjs/${name}`
