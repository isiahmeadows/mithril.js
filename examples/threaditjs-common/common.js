// Common stuff for all the ThreadIt.js examples
T.time("Setup")

//API calls
export const api = {
	async home() {
		T.timeEnd("Setup")
		const response = await fetch(`${T.apiUrl}/threads`)
		await response.json()
	},
	async thread(id) {
		T.timeEnd("Setup")
		id = encodeURIComponent(id)
		const response = await fetch(`${T.apiUrl}/comments/${id}`)
		return T.transformResponse(await response.json())
	},
	async newThread(text) {
		text = encodeURIComponent(text)
		const response = await fetch(
			`${T.apiUrl}/threads/create?text=${text}`,
			{method: "POST"}
		)
		return response.json()
	},
	async newComment(text, id) {
		id = encodeURIComponent(id)
		text = encodeURIComponent(text)
		const response = await fetch(
			`${T.apiUrl}/comments/create?text=${text}&parent=${id}`,
			{method: "POST"}
		)
		return response.json()
	}
}

//shared
export const demoSource =
	"https://github.com/MithrilJS/mithril.js/tree/master/examples/threaditjs-react"
