import {
    ComponentAttributesObject, PolymorphicComponent,
    VnodeComponent, StateValue, ErrorValue,
    Component, Environment, create, Type
} from "./internal/vnode"
import {
    defer0,
    ERROR_SENTINEL,
    SENTINEL,
    SentinelValue,
    ErrorSentinelValue,
} from "./internal/util"

type _ClonedLazy<C extends PolymorphicComponent> =
    C extends Component<infer A, Polymorphic, infer E>
        ? Component<A, never, E>
        : never

export function lazy<
    C extends PolymorphicComponent
>(
    init: () => Await<{default: C}>,
): C extends Component<infer A, infer S, infer E> ? Component<A, S, E> : never
export function lazy<
    C extends PolymorphicComponent,
    K extends string,
>(
    init: () => Await<{[P in K]: C}>,
    key: K
): _ClonedLazy<C>

// This is written to have 4 states, but they all reuse the same values to
// minimize code size and memory size both:
//
// - Initial:
//   - `init`: initializer
//   - `key`: export name
// - Pending:
//   - `init`: sentinel value (already extracted to be called)
//   - `key`: export name
// - Ready:
//   - `init`: component reference
//   - `key`: sentinel value (no longer needed)
// - Ready:
//   - `init`: error value
//   - `key`: error sentinel value (to denote it's an error)

export function lazy<
    A extends ComponentAttributesObject,
    S extends StateValue, E extends Environment,
    K extends string
>(
    init: (() => Await<
        & {default?: Component<A, S, E>}
        & {[P in K]: Component<A, S, E>}
    >) | Component<A, S, E> | ErrorValue | SentinelValue,
    key?: K | "default" | ErrorSentinelValue | SentinelValue
): Component<A, never, E> {
    if (key == null) key = "default"

    return (attrs, info): Maybe<VnodeComponent> => {
        if (SENTINEL === key) {
            // Return a full component vnode, so lifecycle tracking can be
            // accurate.
            return create<VnodeComponent>(Type.Component, [
                init as PolymorphicComponent,
                attrs
            ])
        }

        if (ERROR_SENTINEL === key) {
            throw init
        }

        type _M = (
            & {default?: Component<A, S, E>}
            & {[P in K]: Component<A, S, E>}
        )

        if (SENTINEL !== init) {
            const func = init as () => _M | PromiseLike<_M>
            init = SENTINEL
            defer0(func).then(
                (v: _M | _M[K]): void => {
                    try {
                        if (typeof (v = (v as _M)[key as K]) === "function") {
                            init = v
                            key = SENTINEL
                        } else {
                            // This will generally be informative even in
                            // transpiled code and code bundled in dev mode.
                            throw new TypeError(
                                "Function did not resolve with a valid " +
                                "component entry point: " + func.toString()
                            )
                        }
                    } catch (e) {
                        key = ERROR_SENTINEL
                        info.throw(init = e as ErrorValue, false)
                    }
                },
                (e: ErrorValue) => {
                    key = ERROR_SENTINEL
                    info.throw(init = e, false)
                }
            )
        }

        return void 0
    }
}
