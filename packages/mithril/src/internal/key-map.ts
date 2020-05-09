declare const KeyMapMarker: unique symbol

interface KeyMap<K extends Any, V extends Any> {
    // To ensure it's read as invariant
    [KeyMapMarker]: (key: K, value: V) => [K, V]
}

interface KeyMapModule {
    T: new <K extends Any, V extends Any>() => KeyMap<K, V>
    g<K extends Any, V extends Any>(m: KeyMap<K, V>, key: K): V
    s<K extends Any, V extends Any>(m: KeyMap<K, V>, key: K, value: V): void
}

// This is some seriously unsafe code, and it's easiest if I disable the type
// checker and most type-directed lints here. There's no pretty way to handle
// this - it exists to allow me to have a reliable fallback for keyed diffs
// where possible, but without preventing engines from correctly inlining them.
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/ban-ts-ignore */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

export const KeyMap: KeyMapModule = typeof Map === "function"
    ? {
        T: Map as any,

        g: <K extends Any, V extends Any>(m: KeyMap<K, V>, k: K) =>
            (m as any).get(k),

        s: <K extends Any, V extends Any>(m: KeyMap<K, V>, k: K, v: V) => {
            (m as any).set(k, v)
        },
    }
    : {
        T: (() => {
            function Dict() {}
            // @ts-ignore
            Dict.prototype = null
            return Dict
        })() as any,

        g: <K extends Any, V extends Any>(m: KeyMap<K, V>, k: K) =>
            (m as any)[k as any],

        s: <K extends Any, V extends Any>(m: KeyMap<K, V>, k: K, v: V) => {
            (m as any)[k as any] = v
        },
    }
