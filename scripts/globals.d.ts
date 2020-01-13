// This contains all the globals injected during compilation, as well as any
// relevant ES6 compatibility, as this is compiled targeting ES5.
//
// Intentionally, it's very much incomplete, as we want to limit the surface
// area of what we assume, and I want all APIs we rely on tracked closely and in
// one place.
//
// If it's prefixed with `__internal__`, it's private to this file and should
// *not* be used.

///<reference lib="es2015.symbol" />
///<reference lib="es2015.promise" />
///<reference lib="es2015.iterable" />
export {}
declare global {
    export const __DEV__: boolean

    type Assert<T extends U, U> = {actual: T, expected: U}
    // Ideally, `A & B` would narrow to `never` if `A` is a function and `B` is
    // a primitive, but alas, nope.
    type Is<T, U> = T extends U ? true : false

    // Until I get an `awaited T` type, this is the closest I'm going to get.
    type Await<T> = T | _AwaitPromise<T>
    interface _AwaitPromise<T> extends PromiseLike<Await<T>> {}

    // For convenience when dealing with API contracts
    type APIOptional<T> = T | null | undefined
    type Maybe<T> = T | undefined

    // So narrowing works as it's supposed to.
    type Any =
        string | object | boolean | symbol | number | bigint | null | undefined

    // Workaround for https://github.com/microsoft/TypeScript/issues/36470
    interface CallableFunction {
        apply<T, R>(
            // This intentionally uses the bottom type, so it's always
            // considered assignable. This is *very* unsafe, hence why it's
            // restricted only to `arguments`.
            this: (this: T, ...args: never[]) => R,
            thisArg: T, args: IArguments
        ): R
    }
}
