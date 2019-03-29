// `prefersDarkMode` from `./dark-mode.mjs` with all dependencies included. As
// an exception, `watchMedia` is specialized to just return whether it matches.
import {all} from "mithril/cell"

function localStorage(key) {
	return (send) => {
		function sendValue() {
			const item = window.localStorage.getItem(key)
			send([item ? JSON.parse(item) : undefined, (value) => {
				window.localStorage.setItem(key, JSON.stringify(value))
				sendValue()
			}])
		}
		window.addEventListener("storage", sendValue, false)
		sendValue()
		return () => window.removeEventListener("storage", sendValue, false)
	}
}

function watchMedia(query) {
	return (send) => {
		const mql = window.matchMedia(query)
		const handler = () => send(mql.matches)
		mql.addListener(handler)
		handler()
		return () => mql.removeListener(handler)
	}
}

export default all([
	watchMedia("(prefers-color-scheme: dark)"),
	localStorage("dark-mode-enabled"),
], ([prefersDarkMode, [enabled = prefersDarkMode, setEnabled]]) => {
	if (enabled) {
		document.body.classList.add("dark-mode");
	} else {
		document.body.classList.remove("dark-mode");
	}

	return [Boolean(enabled), setEnabled]
})
