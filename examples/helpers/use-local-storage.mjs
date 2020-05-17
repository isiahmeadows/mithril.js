// Translated from https://usehooks.com/useLocalStorage/, but doesn't assume the
// stream has full control over the storage.
import {useInfo, memo, useEffect} from "mithril"

export function useLocalStorage(key) {
    const value = window.localStorage.getItem(key)
    const parsed = memo(value, () => value ? JSON.parse(value) : undefined)

    const info = useInfo()
    useEffect(() => {
        const handle = () => info.redraw()
        window.addEventListener("storage", handle, false)
        return () => {
            window.removeEventListener("storage", handle, false)
        }
    })

    return parsed
}

export function setLocalStorage(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value))
}
