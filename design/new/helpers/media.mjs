// Translated from https://usehooks.com/useMedia/, with a few bugs fixed.
import {chain, distinct} from "mithril/stream"
import shallowEqual from "shallow-equal"

export function watchMedia(queries, defaultValue) {
    return chain(
        distinct(queries, shallowEqual),
        (queries) => (o) => {
            const mqls = queries.map(([q, v]) => [window.matchMedia(q), v])
            const handler = () => {
                const index = mqls.findIndex((mql) => mql[0].matches)
                o.next(index >= 0 ? mqls[index][1] : defaultValue)
            }
            mqls.forEach((mql) => mql.addListener(handler))
            handler()
            return () => mqls.forEach((mql) => mql.removeListener(handler))
        }
    )
}
