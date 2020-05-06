import * as V from "./internal/vnode"

// There's enough non-null assertions here it might as well have a `.js`
// extension. But I need them all, and there's no real way to avoid it without
// bloating the helper.
/* eslint-disable @typescript-eslint/no-non-null-assertion */

type Target = V.RenderTarget | (() => V.RenderTarget)

interface PortalState {
    t: Maybe<Target>
    c: Maybe<V.Vnode[]>
    i: Maybe<V.ComponentInfo<V.StateValue>>
    r: Maybe<Promise<V.CloseCallback>>
    f: V.WhenRemovedCallback
}

export default function portal(target: Target, ...children: V.Vnode[]) {
    return V.create(V.Type.State, ((info: V.ComponentInfo<PortalState>) => {
        if (info.state == null) {
            info.state = {
                t: void 0,
                c: void 0,
                i: void 0,
                r: void 0,
                f: () => (
                    info.state!.r!.then((close) => close())
                ) as Any as Await<V.WhenRemovedResult>,
            }
        }

        info.state.c = children
        info.whenRemoved(info.state.f)

        // Defer the update, so things get queued correctly and so in the event
        // a ref needs rendered to, this can still be up to the task.
        info.whenReady((): Await<V.WhenReadyResult> => {
            const resolved = typeof target === "function"
                ? target()
                : target

            if (info.state!.t === resolved) {
                return info.state!.i?.redraw() as Any as V.WhenReadyResult
            }

            return (
                info.state!.r = info.render<V.StateValue>(
                    info.state!.t = resolved,
                    (childInfo) => {
                        info.state!.i = childInfo
                        return info.state!.c
                    }
                )
            ) as Any as Promise<V.WhenReadyResult>
        })
    }) as Any as V.StateInit<V.StateValue>)
}
