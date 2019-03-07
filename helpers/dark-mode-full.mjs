// `prefersDarkMode` from `./dark-mode.mjs` with all dependencies included. As
// an exception, `watchMedia` is specialized to just return whether it matches.
import {all, chain, map, of, watch} from "mithril/state"

function localStorage(key, defaultValue) {
	return (context) => {
		const item = window.localStorage.getItem(key)
		const value = item ? JSON.parse(item) : defaultValue
		return {value, ref: (value) => {
			window.localStorage.setItem(key, JSON.stringify(value))
			context.update()
		}}
	}
}

function watchMedia(query) {
	return map(
		watch(query, (context) => {
			const mql = window.matchMedia(query)
			const handler = () => context.update()
			mql.addListener(handler)
			return {value: mql, done() { mql.removeListener(handler) }}
		}),
		(mql) => mql.matches
	)
}

export default chain(
	all([
		watchMedia("(prefers-color-scheme: dark)"),
		map(localStorage("dark-mode-enabled", false), Boolean),
	]),
	([prefersDarkMode, enabled = prefersDarkMode], [, setEnabled]) => {
		if (enabled) {
			document.body.classList.add("dark-mode");
		} else {
			document.body.classList.remove("dark-mode");
		}

		return of(enabled, setEnabled)
	}
)
