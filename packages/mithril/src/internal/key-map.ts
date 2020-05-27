import {eachKeyOrSymbol} from "./util"

declare const KeyMapMarker: unique symbol
declare const KeySetMarker: unique symbol

export interface KeyMap<K extends Any, V extends Any> {
    // To ensure it's read as invariant
    [KeyMapMarker]: (key: K, value: V) => [K, V]
}

export interface KeySet<K extends Any> {
    // To ensure it's read as invariant
    [KeySetMarker]: (key: K) => K
}

interface KeyMapModule {
    T: new <K extends Any, V extends Any>() => KeyMap<K, V>
    g<K extends Any, V extends Any>(m: KeyMap<K, V>, key: K): V
    s<K extends Any, V extends Any>(m: KeyMap<K, V>, key: K, value: V): void
    e<K extends Any, V extends Any>(
        m: KeyMap<K, V>,
        func: (key: K, value: V) => void
    ): void
}

interface KeySetModule {
    T: new <K extends Any>() => KeySet<K>
    h<K extends Any>(m: KeySet<K>, key: K): boolean
    a<K extends Any>(m: KeySet<K>, key: K): void
    e<K extends Any>(m: KeySet<K>, func: (key: K) => void): void
}

// Using a class rather than `Object.create(null)` so I can just directly do
// `new KeyMap.T()`/`new KeySet.T()`. Simpler and has slightly less overhead.
const Dict = /*@__PURE__*/ (() => {
function Dict() {}
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore This is just a standard JS hack.
Dict.prototype = null
return Dict
})()

// There's a few spots that need to verify this.
export function supportsNativeKeys(
    object: KeyMap<Any, Any> | KeySet<Any>
): boolean {
    return Object.getPrototypeOf(object) !== null
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

        e: <K extends Any, V extends Any>(
            m: KeyMap<K, V>,
            func: (key: K, value: V) => void
        ) => {
            (m as any).forEach(func)
        }
    }
    : {
        T: Dict as any,

        g: <K extends Any, V extends Any>(m: KeyMap<K, V>, k: K) =>
            (m as any)[k as any],

        s: <K extends Any, V extends Any>(m: KeyMap<K, V>, k: K, v: V) => {
            (m as any)[k as any] = v
        },

        e: eachKeyOrSymbol as KeyMapModule["e"]
    }

export const KeySet: KeySetModule = typeof Set === "function"
    ? {
        T: Set as any,
        h: <K extends Any>(m: KeySet<K>, k: K) => (m as any).has(k),
        a: <K extends Any>(m: KeySet<K>, k: K) => { (m as any).add(k) },
        e: <K extends Any>(m: KeySet<K>, func: (key: K) => void) => {
            (m as any).forEach(func)
        }
    }
    : {
        T: Dict as any,

        h: <K extends Any>(m: KeySet<K>, k: K) =>
            (k as any) in (m as any),

        a: <K extends Any>(m: KeySet<K>, k: K) => {
            (m as any)[k as any] = true
        },

        e: eachKeyOrSymbol as KeySetModule["e"]
    }
