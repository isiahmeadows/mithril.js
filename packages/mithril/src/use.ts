import {AbortSignal} from "./internal/dom"
import {
    VnodeAttributes, ComponentInfo, WhenRemovedResult, WhenRemovedCallback,
    Vnode, ErrorValue
} from "./internal/vnode"

type UseAttrs<T extends Any> = VnodeAttributes & {
    init(signal: AbortSignal): Await<T>
    pending(): Vnode
    ready(value: T): Vnode
    error(value: ErrorValue): Vnode
}

const enum State {
    Pending,
    Ready,
    Error,
}

interface UseState<T extends Any> {
    s: State
    v: T | ErrorValue | undefined
    r: WhenRemovedCallback
}

export function Use<T extends Any>(
    attrs: UseAttrs<T>,
    info: ComponentInfo<UseState<T>>
): Vnode {
    let state = info.state

    if (state == null) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const controller = new info.window!.AbortController()
        state = info.state = {
            s: State.Pending,
            v: void 0,
            r: () => {
                controller.abort()
                return void 0 as Any as WhenRemovedResult
            }
        }

        Promise.resolve(controller.signal).then(attrs.init).then(
            (v) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                state!.s = State.Ready
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                state!.v = v as T
            },
            (e) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                state!.s = State.Ready
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                state!.v = e as ErrorValue
            }
        )
    }

    info.whenRemoved(state.r)

    if (state.s === State.Pending) return attrs.pending()
    if (state.s === State.Ready) return attrs.ready(state.v as T)
    /* if (state.s === State.Error) */ return attrs.error(state.v as ErrorValue)
}
