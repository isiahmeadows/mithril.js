import * as V from "./internal/vnode"
import {arrayify} from "./internal/util"

// Yes, efficient and correct portaling is this non-trivial.
type SchedulePortalAttrs = V.VnodeAttributes & {
    v: [V.RenderTarget, ...V.Vnode[]]
}

interface SchedulePortalState {
    c: V.Vnode
    i: Maybe<V.ComponentInfo<V.StateValue>>
    f: V.WhenRemovedCallback
    p: (value: Error) => void
}

function SchedulePortal(
    {v: [target, ...vnodes]}: SchedulePortalAttrs,
    info: V.ComponentInfo<SchedulePortalState>
) {
    if (info.state == null) {
        info.state = {
            c: void 0,
            i: void 0,
            f: () => promise.then((close) => close()) as Any as
                Await<V.WhenRemovedResult>,
            p: (e) => { info.throw(e as Any as V.ErrorValue, true) },
        }

        const promise = info.render<V.StateValue>(target, (childInfo) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            info.state!.i = childInfo
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return info.state!.c
        })
    }

    info.state.c = vnodes
    info.whenRemoved(info.state.f)
    if (info.state.i != null) {
        info.state.i.redraw().catch(info.state.p)
    }
}

export default function portal(
    target: V.RenderTarget, ...children: V.Vnode[]
): V.Vnode
export default function portal(target: V.RenderTarget) {
    return V.create(V.Type.Link, [
        target as Any as V.LinkValue,
        V.create(V.Type.State, [
            SchedulePortal as Any as V.Component<V.VnodeAttributes, Any>,
            {v: arrayify.apply(0, arguments)}
        ])
    ])
}
