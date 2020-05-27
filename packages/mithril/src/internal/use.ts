import {ErrorValue} from "./vnode"

export const enum UseState {
    Pending,
    Ready,
    Error,
}

const StateLookup = ["pending", "ready", "error"] as const
type UseStateKeys = typeof StateLookup

export interface UseMatchers<T extends Polymorphic, R> {
    pending(): R
    ready(value: T): R
    error(value: ErrorValue): R
}

export type Use<T extends Polymorphic> =
    | {$: UseState.Pending, _: void} & UseCommon<T>
    | {$: UseState.Ready, _: T} & UseCommon<T>
    | {$: UseState.Error, _: ErrorValue} & UseCommon<T>

type UseCommon<T extends Polymorphic> = {
    state(this: Use<T>): UseStateKeys[(typeof this)["$"]]
    value(this: Use<T>): (typeof this)["_"]
    match<R extends Polymorphic>(this: Use<T>, matchers: UseMatchers<T, R>): R
}

type UseConstructor = {
    new<T extends Polymorphic>(
        state: UseState,
        value: (Use<T> & {$: typeof state})["_"]
    ): Use<T>
    prototype: UseCommon<Polymorphic>
}

export const Use: UseConstructor = /*@__PURE__*/ (() => {
    function Use<T extends Polymorphic>(
        this: Use<T>,
        state: UseState,
        value: Use<T>["_"]
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
