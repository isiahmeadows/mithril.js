// Translated from https://usehooks.com/useLocalStorage/, but doesn't assume the
// stream has full control over the storage.
import {memo, whenEmitted, isInitial} from "mithril"

export function useLocalStorage(key, initial) {
    const value = window.localStorage.getItem(key)
    if (isInitial()) window.localStorage.setItem(key, JSON.stringify(initial))
    const parsed = memo(value, () => value ? JSON.parse(value) : undefined)

    whenEmitted(window, "storage", () => {})

    return parsed
}

export function setLocalStorage(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value))
}
