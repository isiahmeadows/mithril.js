// Translated from https://usehooks.com/useMedia/, with a few bugs fixed and it
// specialized to only watch one query (as would generally make sense IMHO -
// it's less overengineered that way).
import {guard, useEffect, hasChanged, useInfo, memo} from "mithril"

export function isMedia(query) {
    return guard(hasChanged(query), () => {
        const mql = memo(() => window.matchMedia(query))

        const info = useInfo()
        useEffect(() => {
            const handler = () => info.redraw()
            mql.addListener(handler)
            return () => mql.removeListener(handler)
        })

        return mql.matches
    })
}
