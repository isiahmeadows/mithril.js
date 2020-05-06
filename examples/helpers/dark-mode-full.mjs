// `./dark-mode.mjs` with all dependencies inlined and everything specialized.
//
// This is probably closer to what one would expect of real-world code.
import {useEffect, memo, useInfo, usePortal} from "mithril"

export default function isDarkMode() {
    const mql = memo(() => window.matchMedia("(prefers-color-scheme: dark)"))
    const info = useInfo()

    useEffect(() => {
        const handle = () => info.redraw()
        mql.addListener(handle)
        return () => mql.removeListener(handle)
    })

    const value = window.localStorage.getItem("dark-mode-enabled")
    const enabled = value ? Boolean(value) : mql.matches

    usePortal(document.body, {class: {"dark-mode": enabled}})
    usePortal(window, {on: {storage: () => info.redraw()}})

    return enabled
}

export function setDarkMode(value) {
    window.localStorage.setItem("dark-mode-enabled", Boolean(value))
}
