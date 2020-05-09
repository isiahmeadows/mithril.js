export type ArrayCoercible<T extends Any> = Iterable<T> | ArrayLike<T>

// export type UnionOf<T extends Any[]> = T[number]
// export type IntersectionOf<T extends Any[]> = _Intersect<T, Any>
// // `infer T` infers a value extending `unknown` directly, so I have to use
// // `unknown` for the parameter.
// type _Intersect<L extends unknown[], R> = {
//     0: R
//     1: ((...l: L) => Any) extends ((h: infer H, ...t: infer T) => Any)
//         ? _Intersect<T, R & H>
//         : never
// }[L extends [] ? 0 : 1]

export const assign: (
    <T extends AnyNotNull>(target: T, source: Maybe<Partial<T>>) => T
) =
    /*@__PURE__*/ Object.assign ||
        (<T extends AnyNotNull>(target: T, source: Partial<T>) => {
            for (var key in source) {
                if (hasOwn.call(source, key)) {
                    target[key] = source[key] as T[typeof key]
                }
            }
            return target
        })

export const fill: <T extends Any>(
    this: T[],
    value: T,
    start: number | undefined,
    end: number | undefined
) => void =
    // `unknown` used specifically to satisfy the type checker
    /*@__PURE__*/ ([] as Any[]).fill ||
    function <T extends Any>(this: T[], value: T, start: number, end: number): void {
        while (start < end) this[start++] = value
    }

export const hasOwn = /*@__PURE__*/ {}.hasOwnProperty
export const propertyIsEnumerable = /*@__PURE__*/ {}.propertyIsEnumerable

export function assertDevelopment(): void {
    if (!__DEV__) {
        throw new ReferenceError(
            "INTERNAL: This should never be called in a production build."
        )
    }
}

declare const SentinelValueMarker: unique symbol
export type SentinelValue = object & {
    [SentinelValueMarker]: void
}

export const SENTINEL = {} as SentinelValue

export function noop() { return void 0 }

// For things that need to run async but don't need scheduled
export const promise = Promise.resolve()

// Low-level because I need to control the emit
export function arrayify<T extends Any[]>(this: number, ...args: T): T
export function arrayify<T extends Any[]>(this: number): T {
    const result = []
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    for (let i = this; i < arguments.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        result.push(arguments[i])
    }
    return result as T
}

export function eachKey<T extends Polymorphic>(
    value: T,
    func: <K extends string & keyof T>(value: T[K], key: K) => void
): void {
    for (const key in value) {
        if (hasOwn.call(value, key)) {
            func(value[key], key)
        }
    }
}

export const eachKeyOrSymbol = /*@__PURE__*/ (
    Object.getOwnPropertySymbols
        ? <T extends Polymorphic>(
            value: T,
            func: <K extends keyof T>(value: T[K], key: K) => void
        ): void => {
            eachKey(value, func)
            type _Symbols = Array<keyof T & symbol>
            for (const key of Object.getOwnPropertySymbols(value) as _Symbols) {
                if (propertyIsEnumerable.call(value, key)) func(value[key], key)
            }
        }
        : eachKey
)

export function remove<T extends Any>(list: T[], item: T): void {
    const index = list.indexOf(item)
    if (index >= 0) list.splice(index, 1)
}

export const invalidSelectorSequence = /^$|^\.| |\.\.|\.$/
