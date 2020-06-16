// `./dark-mode.mjs` with all dependencies inlined and everything specialized.
//
// This is probably closer to what one would expect of real-world code.
import {
    useEffect, whenEmitted, memo, useInfo, hasChanged, whenRemoved, isInitial
} from "mithril"

export default function isDarkMode() {
    const mql = memo(() => window.matchMedia("(prefers-color-scheme: dark)"))
    const info = useInfo()

    useEffect(() => {
        const handle = () => info.redraw()
        mql.addListener(handle)
        return () => mql.removeListener(handle)
    })

    const value = window.localStorage.getItem("dark-mode-enabled")
    const enabled = value != null ? Boolean(value) : mql.matches

    if (isInitial()) {
        window.localStorage.setItem("dark-mode-enabled", enabled)
    }

    whenEmitted(window, "storage", () => {})

    if (hasChanged(enabled)) {
        document.body.classList.toggle("dark-mode", enabled)
    }

    whenRemoved(() => {
        document.body.classList.remove("dark-mode")
    })

    return enabled
}

export function setDarkMode(value) {
    window.localStorage.setItem("dark-mode-enabled", Boolean(value))
}
