// Translated from https://usehooks.com/useDarkMode/
import {all, chain, map, of} from "mithril/state"
import localStorage from "./local-storage.mjs"
import watchMedia from "./media.mjs"

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
