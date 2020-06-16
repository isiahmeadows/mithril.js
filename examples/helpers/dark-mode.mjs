// Translated from https://usehooks.com/useDarkMode/
import {whenRemoved, hasChanged} from "mithril"
import {useLocalStorage, setLocalStorage} from "./use-local-storage.mjs"
import {isMedia} from "./is-media.mjs"

export function isDarkMode() {
    const prefersDarkMode = isMedia("(prefers-color-scheme: dark)")

    const [enabled, setEnabled] =
        useLocalStorage("dark-mode-enabled", prefersDarkMode)

    if (hasChanged(enabled)) {
        document.body.classList.toggle("dark-mode", enabled)
    }

    whenRemoved(() => {
        document.body.classList.remove("dark-mode")
    })

    return [Boolean(enabled), setEnabled]
}

export function setDarkMode(enabled) {
    setLocalStorage("dark-mode-enabled", Boolean(enabled))
}
