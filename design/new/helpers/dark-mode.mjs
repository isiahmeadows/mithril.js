// Translated from https://usehooks.com/useDarkMode/
import {all, map, of} from "mithril/stream"
import localStorage from "./local-storage.mjs"
import watchMedia from "./media.mjs"

export default map(all(
    watchMedia(of(["(prefers-color-scheme: dark)", true]), false),
    localStorage("dark-mode-enabled")
), ([prefersDarkMode, [enabled = prefersDarkMode, setEnabled]]) => {
    if (enabled) {
        document.body.classList.add("dark-mode")
    } else {
        document.body.classList.remove("dark-mode")
    }

    return [Boolean(enabled), setEnabled]
})
