declare const KeyMapMarker: unique symbol

export interface T<K extends Polymorphic> {
    // Set to a function to ensure it's treated as invariant by TS
    [KeyMapMarker]: (key: K) => [K]
}

// This is some seriously unsafe code, and it's easiest if I disable most
// type-directed lints here. There's no pretty way to handle this - it exists to
// allow me to have a reliable fallback for keyed diffs where possible, but
// without preventing engines from correctly inlining them. I've typed out the
// assumptions and I use a synthetic type to encapsulate it (using a similar
// trick to what I use with attributes and such), so assumptions here won't
// escape elsewhere.
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

// Mark it as pure so it's properly stripped if it's not used.
export const isNative = /*@__PURE__*/ typeof Set === "function"

export const T: new <K extends Polymorphic>() => T<K> =
    isNative
        ? Set as any
        // Using a class rather than `Object.create(null)` so I can just call
        // the constructor dorectly rather than wraping it. Simpler and with
        // slightly less overhead in modern browsers that have a native `Map`.
        : /*@__PURE__*/ (() => {
            function Dict() {}
            Dict.prototype = null as any
            return Dict as any
        })()

export const has: <K extends Polymorphic>(set: T<K>, key: K) => boolean =
    isNative
        ? (m: any, k: any) => m.has(k)
        : (m: any, k: any) => m[k]

export const add: <K extends Polymorphic>(set: T<K>, key: K) => void =
    isNative
        ? (m: any, k: any) => { m.add(k) }
        : (m: any, k: any) => { m[k] = true }
