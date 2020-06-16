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
    <T extends AnyNotNull>(target: T, source: APIOptional<Partial<T>>) => T
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

export function merge<T extends {}, U extends {}>(a: T, b: U): T & U {
    return assign(assign({} as T & U, a), b)
}

export const fill: <T extends Any>(
    this: T[],
    value: T,
    start: number | undefined,
    end: number | undefined
) => void =
    // `unknown` used specifically to satisfy the type checker
    /*@__PURE__*/ ([] as Any[]).fill ||
    function <T extends Any>(
        this: T[], value: T, start: number, end: number
    ): void {
        while (start < end) this[start++] = value
    }

export const hasOwn = /*@__PURE__*/ {}.hasOwnProperty
export const propertyIsEnumerable = /*@__PURE__*/ {}.propertyIsEnumerable

export function isEmpty(value: Polymorphic) {
    if (value != null) {
        for (const key in value as object) {
            if (hasOwn.call(value, key)) return false
        }
    }
    return true
}

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

declare const ErrorSentinelValueMarker: unique symbol
export type ErrorSentinelValue = object & {
    [ErrorSentinelValueMarker]: void
}

export const ERROR_SENTINEL = {} as ErrorSentinelValue

export function noop() { return void 0 }

// 1. It's marginally faster.
// 2. It allows me to control object lifetimes better to ensure things get
//    collected as early as possible.
// 3. It's not any less readable and in some cases more readable.
/*@__NOINLINE__*/ export function constant<T>(value: T) {
    return () => value
}
/*@__NOINLINE__*/ export function defer0<T>(func: () => Await<T>): Promise<T> {
    return promise.then(() => func() as T)
}
/*@__NOINLINE__*/ export function defer1<T, A>(
    func: (value: A) => Await<T>,
    value: A
): Promise<T> {
    return promise.then(() => func(value) as T)
}

// For things that need to run async but don't need scheduled
export const promise = Promise.resolve()

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
