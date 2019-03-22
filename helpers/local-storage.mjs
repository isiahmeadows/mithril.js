// Translated from https://usehooks.com/useLocalStorage/, but doesn't assume the
// cell has full control over the storage.
export default function localStorage(key) {
	return (context) => {
		function sendValue() {
			const item = window.localStorage.getItem(key)
			context.send([item ? JSON.parse(item) : undefined, (value) => {
				window.localStorage.setItem(key, JSON.stringify(value))
				sendValue()
			}])
		}
		window.addEventListener("storage", sendValue, false)
		sendValue()
		return () => window.removeEventListener("storage", sendValue, false)
	}
}
