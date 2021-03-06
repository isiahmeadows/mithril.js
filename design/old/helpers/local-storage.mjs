// Translated from https://usehooks.com/useLocalStorage/, but doesn't assume the
// stream has full control over the storage.
export default function localStorage(key) {
    return (o) => {
        function sendValue() {
            let item = window.localStorage.getItem(key)
            o.next([item ? JSON.parse(item) : undefined, (value) => {
                window.localStorage.setItem(key, JSON.stringify(value))
                sendValue()
            }])
        }
        window.addEventListener("storage", sendValue, false)
        sendValue()
        return () => window.removeEventListener("storage", sendValue, false)
    }
}
