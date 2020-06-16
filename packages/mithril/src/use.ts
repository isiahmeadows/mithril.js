import {AbortSignal} from "./internal/dom"
import {
    ComponentAttributesObject, ComponentInfo, WhenRemovedResult,
    WhenRemovedCallback, Vnode, ErrorValue,
} from "./internal/vnode"
import {defer1} from "./internal/util"
import {Use as UseConstructor, UseState, UseMatchers} from "./internal/use"

type UseAttrs<T extends Polymorphic> = (
    ComponentAttributesObject &
    {init(signal: AbortSignal): Await<T>} &
    UseMatchers<T, Vnode>
)

interface UseComponentState<T extends Polymorphic> {
    s: UseState
    v: T | ErrorValue | undefined
    r: WhenRemovedCallback<ComponentInfo<Polymorphic>>
}

export {UseComponent as Use}
function UseComponent<T extends Polymorphic>(
    attrs: UseAttrs<T>,
    info: ComponentInfo<UseComponentState<T>>
): Vnode {
    let state = info.state

    if (state == null) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const controller = new info.window!.AbortController()
        state = info.state = {
            s: UseState.Pending,
            v: void 0,
            r: () => {
                controller.abort()
                return void 0 as Any as WhenRemovedResult
            }
        }

        defer1(attrs.init, controller.signal).then(
            (v) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                state!.s = UseState.Ready
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                state!.v = v
            },
            (e) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                state!.s = UseState.Ready
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                state!.v = e as ErrorValue
            }
        )
    }

    info.whenRemoved(state.r)
    return new UseConstructor(state.s, state.v).match(attrs)
}

type UseAllAttrs = ComponentAttributesObject & {
    init: Array<(signal: AbortSignal) => Await<Polymorphic>>
    view(results: UseConstructor<Polymorphic>[]): Vnode
}

type StateArray = Array<Maybe<UseState | Polymorphic | ErrorValue>>

type UseAllComponentState = {
    s: StateArray
    r: WhenRemovedCallback<ComponentInfo<Polymorphic>>
}

function invokeInit(
    info: ComponentInfo<UseAllComponentState>,
    init: (signal: AbortSignal) => Await<Polymorphic>,
    index: number,
    signal: AbortSignal
) {
    defer1(init, signal).then(
        (v) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const state = info.state!.s
            state[index] = UseState.Ready
            state[index + 1] = v
            info.redraw()
        },
        (e) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const state = info.state!.s
            state[index] = UseState.Error
            state[index + 1] = e
            info.redraw()
        },
    )
}

export {UseAllComponent as UseAll}
function UseAllComponent(
    attrs: UseAllAttrs,
    info: ComponentInfo<UseAllComponentState>
): Vnode {
    let state = info.state

    if (state == null) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const controller = new info.window!.AbortController()
        state = info.state = {
            s: [],
            r: () => {
                controller.abort()
                return void 0 as Any as WhenRemovedResult
            }
        }

        try {
            for (let i = 0; i < attrs.init.length; i++) {
                state.s.push(UseState.Pending, void 0)
                // eslint-disable-next-line no-bitwise
                invokeInit(info, attrs.init[i], i << 1, controller.signal)
            }
        } catch (e) {
            info.throw(e as ErrorValue, false)
            return
        }

        info.redraw()
    }

    info.whenRemoved(state.r)

    if (state.s == null) return void 0

    const results = [] as UseConstructor<Polymorphic>[]

    for (let i = 0; i < state.s.length; i += 2) {
        results.push(
            new UseConstructor(state.s[i] as UseState, state.s[i + 1])
        )
    }

    return attrs.view(results)
}
