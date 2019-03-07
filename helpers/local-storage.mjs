// Translated from https://usehooks.com/useLocalStorage/, but doesn't assume the
// reducer has full control over the storage.
export default function localStorage(key, defaultValue) {
	return (context) => {
		const item = window.localStorage.getItem(key)
		const value = item ? JSON.parse(item) : defaultValue
		return {value, ref: (value) => {
			window.localStorage.setItem(key, JSON.stringify(value))
			context.update()
		}}
	}
}
