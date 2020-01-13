// Translated from https://usehooks.com/useDarkMode/
import {usePortal} from "mithril"
import {useLocalStorage, setLocalStorage} from "./use-local-storage.mjs"
import {isMedia} from "./is-media.mjs"

export function isDarkMode() {
    const prefersDarkMode = isMedia("(prefers-color-scheme: dark)")

    const [enabled = prefersDarkMode, setEnabled] =
        useLocalStorage("dark-mode-enabled")

    usePortal(document.body, {class: {"dark-mode": enabled}})

    return [Boolean(enabled), setEnabled]
}

export function setDarkMode(enabled) {
    setLocalStorage("dark-mode-enabled", Boolean(enabled))
}
