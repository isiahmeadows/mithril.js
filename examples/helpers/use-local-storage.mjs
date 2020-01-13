// Translated from https://usehooks.com/useLocalStorage/, but doesn't assume the
// stream has full control over the storage.
import {useInfo, memo, usePortal} from "mithril"

export function useLocalStorage(key) {
    const value = window.localStorage.getItem(key)
    const parsed = memo(value, () => value ? JSON.parse(value) : undefined)

    const info = useInfo()
    usePortal(window, {onstorage: () => info.redraw()})

    return parsed
}

export function setLocalStorage(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value))
}
