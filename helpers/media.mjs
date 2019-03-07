// Translated from https://usehooks.com/useMedia/, with a few bugs fixed.
import {map, watchAll} from "mithril/state"

export function watchMedia(queries, values, defaultValue) {
	return map(
		watchAll(queries, (context, queries) => {
			const mqls = queries.map((q) => window.matchMedia(q))
			const handler = () => context.update()
			mqls.forEach((mql) => mql.addListener(handler))
			return {
				value: mqls,
				done() { mqls.forEach((mql) => mql.removeListener(handler)) },
			}
		}),
		(mqls) => {
			const index = mqls.findIndex((mql) => mql.matches)
			return index >= 0 ? values[index] : defaultValue
		}
	)
}
