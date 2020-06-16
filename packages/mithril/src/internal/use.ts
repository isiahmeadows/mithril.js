import {AbortSignal} from "./dom"
import {ErrorValue} from "./vnode"

export const enum UseState {
    Pending,
    Ready,
    Error,
}

const StateLookup = ["pending", "ready", "error"] as const

export type UseStateKeys = typeof StateLookup

export interface UseMatchers<T extends Polymorphic, R extends Polymorphic> {
    pending(): R
    ready(value: T): R
    error(value: ErrorValue): R
}

export type UseCommon<T extends Polymorphic> = {
    state(this: Use<T>): UseStateKeys[(typeof this)["$"]]
    value(this: Use<T>): (typeof this)["_"]
    match<R extends Polymorphic>(this: Use<T>, matchers: UseMatchers<T, R>): R
}

export type Use<T extends Polymorphic> =
    | {$: UseState.Pending, _: void} & UseCommon<T>
    | {$: UseState.Ready, _: T} & UseCommon<T>
    | {$: UseState.Error, _: ErrorValue} & UseCommon<T>

export type __TestUseDiscriminantIsComplete<T extends Polymorphic> =
    Assert<UseState, Use<T>["$"]>

export type __TestUseDiscriminantLacksExtra<T extends Polymorphic> =
    Assert<Use<T>["$"], UseState>

export type __TestUseStateIsString<T extends Polymorphic> =
    Assert<ReturnType<Use<T>["state"]>, string>

export type __TestUseMatchersAreComplete<
    T extends Polymorphic,
    R extends Polymorphic
> = Assert<
    ReturnType<UseMatchers<T, R>[ReturnType<Use<T>["state"]>]>,
    R
>

export type UseInit<T> = (signal: AbortSignal) => Await<T>

type UseConstructor = {
    new<T extends Use<Polymorphic>>(
        state: T["$"],
        value: T["_"]
    ): T
    prototype: UseCommon<Polymorphic>
}

export const Use: UseConstructor = /*@__PURE__*/ (() => {
    function Use<T extends Use<Polymorphic>>(
        this: T,
        state: T["$"],
        value: T["_"]
    ) {
        this.$ = state
        this._ = value
    }

    (Use.prototype as UseCommon<Polymorphic>).state = function () {
        return StateLookup[this.$]
    }

    ;(Use.prototype as UseCommon<Polymorphic>).value = function () {
        return this._
    }

    ;(Use.prototype as UseCommon<Polymorphic>).match = function (matchers) {
        if (this.$ === UseState.Pending) {
            return matchers.pending()
        } else if (this.$ === UseState.Ready) {
            return matchers.ready(this._)
        } else /* if (this.$ === UseState.Error) */ {
            return matchers.error(this._)
        }
    }

    return Use as Any as UseConstructor
})()
