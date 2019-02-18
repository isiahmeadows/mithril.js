import {m, Fragment} from "./m.js"

export function Async(attrs, context, [state, value, ref] = []) {
    if (state == null) {
        const hooks = []
        const close = () => {
            const prev = hooks
            hooks = undefined
            hooks.forEach(hook => { hook() })
        }
        [state, value, ref] = ["pending", undefined, () => close]
        new Promise(resolve => {
            resolve(attrs.init(f => {
                if (state === "pending" && hooks != null) hooks.push(f)
            }))
        }).then(
            v => { context.update(["ready", v, undefined]) },
            e => { context.update(["error", e, undefined]) }
        )
    }

    return m(Fragment, {ref}, m(Fragment, {key: state}, attrs[state](value)))
}
