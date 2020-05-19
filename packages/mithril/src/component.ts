/* eslint-disable no-bitwise */
// Note: this is *very* heavily optimized for speed, not size. It uses a lot of
// hand-rolled and duplicated logic and tries heavily to not use up memory, to
// minimize computational overhead of the DSL, including by taking steps to
// prefer array allocation and avoiding object allocation where possible/
// practical. Everything here is perf-sensitive for the user.
//
// One optimization in particular is that everything here uses global variables
// for its lifecycle management. Also, almost every implementation here uses
// minimal state to do everything.
//
// If I had dependent types + induction, this would be so much easier to verify.

import {noop, assertDevelopment} from "./internal/util"
import {isEqual} from "./internal/is-equal"
import {
    EventEmitter, EventTarget, Event, EventListener,
    AbortSignal, AbortController
} from "./internal/dom"
import {
    AttributesObject, Capture, EventValue,
    ComponentInfo, Environment, EnvironmentValue, WhenCaughtCallback,
    WhenReadyCallback, WhenRemovedResult, WhenRemovedCallback,
    Vnode, Component, ErrorValue
} from "./internal/vnode"

/*************************************/
/*                                   */
/*   C o r e   p r i m i t i v e s   */
/*                                   */
/*************************************/

type CellList = Any[]
type Info = ComponentInfo<CellList>
type RemoveTarget = Info | WhenRemovedCallback[]

const enum Bits {
    NotActive = 0,
    // This exists purely to simplify a lot of conditional checks and provide a
    // consistent means of checking if it's active (conveniently the fast check
    // of `mask === 0`).
    IsActiveOffset = 0,
    // TODO: use this + `IndexMask` instead of `index < 0`.
    IsFirstRunOffset = 1,
    HasRemoveCallbackOffset = 2,
    IsNestedRemoveOffset = 3,
    IndexOffset = 4,

    StateMask = (1 << IndexOffset) - 1,
    IndexMask = ~StateMask,

    IsActive = 1 << IsActiveOffset,
    IsFirstRun = 1 << IsFirstRunOffset,
    HasRemoveCallback = 1 << HasRemoveCallbackOffset,
    IsNestedRemove = 1 << IsNestedRemoveOffset,
}

// Supporting function for `whenEmitted`
function invokeEvent<T extends EventValue>(
    info: Info,
    callback: (value: T, capture: Capture) => Await<void>,
    value: T,
    captured: Maybe<T>
): void {
    const capture = info.createCapture(captured)
    try {
        try {
            const p = callback(value, capture)
            if (p != null && typeof p.then === "function") {
                Promise.resolve(p).catch(e => { info.throw(e, false) })
            }
        } finally {
            if (!capture.redrawCaptured()) info.redraw()
        }
    } catch (e) {
        info.throw(e, false)
    }
}

// Note: this machinery exists to reduce allocated closure memory. The enum
// variants are to avoid needing N different closure constructors (and creating
// a lot of garbage) when all I care about are the different structure widths.
//
// How the optimization works is I'm using an intermediate closure to share the
// cell and info references across all closures for this. Engines represent
// closures as effectively `{parent, data}` pairs where `parent` is a reference
// to the parent and `data` contains the variables in the closure itself. They
// allocate only the minimum bits required for `data`, so there's no wasted
// space.
//
// The obvious way to represent callbacks is by creating them immediately.
// This generally results in a closure like this:
//
// slot:
//     data:
//       info
//       cells
//       index
//     parent: global
//
// But when you use multiple such closures, this gets quite wasteful. For three
// `slot`s, you're allocating nine slots across three closures. For a `guard`, a
// `slot`, and a `use`, it gets even more ridiculous, with ten slots.
//
// guard:
//     data:
//       info
//       cells
//       index
//     parent: global
//
// slot:
//     data:
//       info
//       cells
//       index
//     parent: global
//
// use:
//     data:
//       info
//       cells
//       index
//       abort controller
//     parent: global
//
// Creating a level of indirection reduces this cost significantly. To take the
// last example, you could reduce it to 6 slots with 1 extra closure:
//
// common:
//     data:
//       info
//       cells
//     parent: global
//
// guard:
//     data:
//       index
//     parent: common
//
// slot:
//     data:
//       index
//     parent: common
//
// use:
//     data:
//       index
//       abort controller
//     parent: common
//
// This does *mildly* increase the cost of just one item, however, by adding
// a single intermediate closure without also reducing slot count:
//
// common:
//     data:
//       info
//       cells
//     parent: global
//
// slot:
//     data:
//       index
//     parent: common
//
// For simple cases like this, I feel it's an acceptable tradeoff, as it's a
// *very* small impact - it doesn't impact things like `memo`, `whenRemoved`, or
// `useEffect`. Also, React function components rarely have just one `useState`
// call in my experience, just either zero or multiple such calls, so the
// pathological case isn't common enough to optimize for.
//
// I also made a few changes to ensure that closures with significantly
// different lifetimes (like the `.then` callbacks versus `whenRemoved` callback
// in `use`) to retain separate contexts, so that any data associated with the
// shorter-lived callback doesn't get retained for the full lifetime of the
// component, to further drive down persistent memory costs.
//
// It's also worth noting that internal DSL globals are almost never accessed in
// these closures, so there's no increased indirection in practice aside from
// those two.

const enum StateType {
    Slot,
    Lazy,
    Toggle,
    GuardRemove,
    GuardPromise,
    UsePromise,
    UseRemove,
    Reducer,

    WhenEmittedDOMCallback,
    WhenEmittedNodeCallback,
    WhenEmittedDOMRemove,
    WhenEmittedNodeRemove,
}

interface StateFactory {
    <T extends Any>(index: number, type: StateType.Slot, p: undefined):
        (value: T) => Promise<void>
    <T extends Any>(index: number, type: StateType.Lazy, p: undefined):
        (update: (value: T) => T) => Promise<void>
    (index: number, type: StateType.Toggle, p: undefined):
        () => Promise<void>
    (index: number, type: StateType.GuardRemove, p: undefined):
        WhenRemovedCallback
    (index: number, type: StateType.GuardPromise, p: Promise<Any>): void
    (index: number, type: StateType.UsePromise, p: Promise<Any>): void

    <T>(index: number, type: StateType.Reducer, p: undefined):
        (next: T) => Promise<void>

    (index: number, type: StateType.UseRemove, p: undefined):
        WhenRemovedCallback

    <E extends Event<string>>(
        index: number,
        type: StateType.WhenEmittedDOMCallback,
        p: undefined
    ): EventListener<EventTarget<E>, E>
    <T extends {}, K extends keyof T>(
        index: number,
        type: StateType.WhenEmittedNodeCallback,
        p: undefined
    ): (event: T[K]) => void

    (
        index: number,
        type: StateType.WhenEmittedDOMRemove | StateType.WhenEmittedNodeRemove,
        p: undefined
    ): WhenRemovedCallback
}

function createStateFactory(info: Info, cells: CellList): StateFactory {
    return (<T extends Any>(
        index: number, type: StateType,
        promise?: Promise<T>
    ) => {
        if (type === StateType.Slot) {
            return (next: T) => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
                // @ts-ignore https://github.com/microsoft/TypeScript/issues/35866
                cells[index] = next
                return info.redraw()
            }
        } else if (type === StateType.Lazy) {
            return (update: (value: T) => T) => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
                // @ts-ignore https://github.com/microsoft/TypeScript/issues/35866
                cells[index] = update(cells[index] as T)
                return info.redraw()
            }
        } else if (type === StateType.Toggle) {
            return (): Promise<void> => {
                cells[index] = !cells[index]
                return info.redraw()
            }
        } else if (type === StateType.Reducer) {
            return (next: T): Promise<void> => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
                // @ts-ignore https://github.com/microsoft/TypeScript/issues/35866
                cells[index] = (0, cells[index + 1] as (
                    (acc: Any, next: T) => Any
                ))(cells[index], next)
                return info.redraw()
            }
        } else if (type === StateType.GuardRemove) {
            return (): Await<WhenRemovedResult> => {
                const removes = cells[index + 2] as
                    WhenRemovedCallback[]
                // Clear out unneeded memory references.
                cells[index + 1] =
                cells[index + 2] =
                cells[index + 3] = void 0
                // If there's nothing to await, let's just skip the
                // ceremony.
                if (--(cells[index] as number)) {
                    const p = new Promise<WhenRemovedResult>(
                        (resolve) => { cells[index + 2] = resolve }
                    )
                    if (!removes.length) return p
                    removes.push(() => p)
                } else if (!removes.length) {
                    return void 0 as Any as WhenRemovedResult
                }
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                return runClose(info, removes)!
            }
        } else if (type === StateType.GuardPromise) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            promise!.then(
                () => {
                    if (!--(cells[index] as number)) {
                        (cells[index + 2] as () => void)()
                    }
                },
                (e: ErrorValue): void => {
                    if (!--(cells[index] as number)) {
                        (cells[index + 2] as () => void)()
                    }
                    info.throw(e, false)
                }
            )
            return void 0
        } else if (type === StateType.UsePromise) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            promise!.then(
                (v: T) => {
                    if (cells[index + 2] == null) return
                    cells[index] = UseState.Ready
                    cells[index + 1] = v
                    info.redraw()
                },
                (e: Error) => {
                    if (cells[index + 2] == null) return
                    cells[index] = UseState.Error
                    cells[index + 1] = e
                    info.redraw()
                }
            )
            return void 0
        } else if (type === StateType.UseRemove) {
            return () => {
                const ctrl = cells[index + 3] as AbortController
                cells[index + 2] = cells[index + 3] = void 0
                ctrl.abort()
                return void 0 as Any as WhenRemovedResult
            }
        } else if (type === StateType.WhenEmittedDOMCallback) {
            type _E = T & EventValue
            return (event: _E) => {
                invokeEvent(info, cells[index] as (
                    (event: _E, capture: Capture) => Await<void>
                ), event, event)
            }
        } else if (type === StateType.WhenEmittedNodeCallback) {
            type _E = T & EventValue
            return (event: _E) => {
                invokeEvent(info, cells[index] as (
                    (event: _E, capture: Capture) => Await<void>
                ), event, void 0)
            }
        } else if (type === StateType.WhenEmittedDOMRemove) {
            return (): WhenRemovedResult => {
                type _E = Event<string>
                type _T = EventTarget<_E>
                (cells[index + 1] as _T).removeEventListener(
                    cells[index + 2] as _E["type"],
                    cells[index + 3] as EventListener<_T, _E>,
                    false
                )
                return void 0 as Any as WhenRemovedResult
            }
        } else /* if (type === StateType.WhenEmittedNodeRemove) */ {
            return (): WhenRemovedResult => {
                (cells[index + 1] as EventEmitter<Record<string, any>>).off(
                    cells[index + 2] as string,
                    cells[index + 3] as (event: Any) => void
                )
                return void 0 as Any as WhenRemovedResult
            }
        }
    }) as StateFactory
}

let currentMask: number = Bits.NotActive
let currentInfo: Info
let currentEnv: Environment
let currentCells: CellList
let currentRemoveTarget: RemoveTarget
let currentStateFactory: Maybe<StateFactory>

function getStateFactory(info: Info, cells: CellList) {
    const stateFactory = currentStateFactory
    if (stateFactory != null) return stateFactory
    return currentStateFactory = createStateFactory(info, cells)
}

// Note: each of these are meant to be compiled out. Do *not* reference these
// directly except witin `if (__DEV__) { ... }` blocks and similar.
let currentCellTypes: CellType[]
let currentCellTypeIndex = 0

const enum CellType {
    Guard,
    UseEffect,
    WhenEmitted,
    When,
    Ref,
    Slot,
    UseReducer,
    Lazy,
    Memo,
    UsePrevious,
    UseToggle,
    Use,
    HasChanged,
    HasChangedBy,
}

const CellTypeTable = [
    "guard",
    "useEffect",
    "whenEmitted",
    "when",
    "ref",
    "slot",
    "useReducer",
    "lazy",
    "memo",
    "usePrevious",
    "useToggle",
    "use",
    "hasChanged",
    "hasChangedBy",
] as const

// Note: this should only be called in dev mode.
function validateContext(type: Maybe<CellType>) {
    assertDevelopment()

    if (!currentMask) {
        throw new TypeError(
            "This must only be used inside a component context."
        )
    }

    if (type != null) {
        if (currentMask & Bits.IsFirstRun) {
            currentCellTypes.push(type)
        } else {
            const expected = currentCellTypes[currentCellTypeIndex++]
            if (expected !== type) {
                throw new TypeError(
                    `Found \`${CellTypeTable[type]}(...)\` when ` +
                    `\`${CellTypeTable[expected]}\` was expected.`
                )
            }
        }
    }
}

function runClose(
    info: Info,
    removes: WhenRemovedCallback[]
): Maybe<Promise<WhenRemovedResult>> {
    // Wait for all to settle - doesn't matter what the result is.
    let open = 1
    let resolve: () => void

    function onResolve() {
        if (!--open) resolve()
    }

    function onReject(e: ErrorValue) {
        if (!--open) resolve()
        // Report rejections inline, so they get properly accounted for.
        info.throw(e, false)
    }

    for (let i = 0; i < removes.length; i++) {
        open++
        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
            // @ts-ignore https://github.com/microsoft/TypeScript/issues/35866
            const p = (0, removes[i])()
            if (
                p != null &&
                typeof (p as PromiseLike<Any>).then === "function"
            ) {
                Promise.resolve(p).then(onResolve, onReject)
            } else {
                open--
            }
        } catch (e) {
            open--
            info.throw(e as ErrorValue, false)
        }
    }

    open--
    // Only create and await the promise if there's actually things to await, as
    // a small optimization.
    if (open) return new Promise((r) => resolve = r)
    return void 0
}
export function component<
    A extends AttributesObject,
    E extends Environment = Environment
>(
    body: (attrs: A) => Vnode
): Component<A, CellList, E>
export function component<
    A extends AttributesObject,
    E extends Environment = Environment
>(
    name: string,
    body: (attrs: A) => Vnode
): Component<A, CellList, E>
export function component<
    A extends AttributesObject,
    E extends Environment = Environment
>(
    name: string | ((attrs: A) => Vnode),
    body?: (attrs: A) => Vnode
): Component<A, CellList, E> {
    if (body == null) {
        body = name as (attrs: A) => Vnode
        name = ""
    }

    function Comp(attrs: A, info: Info, env: E) {
        const prevMask = currentMask
        const prevInfo = currentInfo
        const prevEnv = currentEnv
        const prevCells = currentCells
        const prevRemoveTarget = currentRemoveTarget
        const prevStateFactory = currentStateFactory
        let prevCellTypes: Maybe<CellType[]>
        let prevCellTypeIndex = 0

        if (__DEV__) {
            prevCellTypes = currentCellTypes
            prevCellTypeIndex = currentCellTypeIndex
        }

        const cells = info.state

        // Fast path: always set everything.
        currentMask = Bits.IsActive
        currentInfo = info
        currentEnv = env
        currentCells = cells as CellList
        currentRemoveTarget = info
        currentStateFactory = void 0

        // Slow path: set another variable and allocate the array.
        if (cells == null) {
            currentMask = Bits.IsActive | Bits.IsFirstRun
            currentCells = info.state = []
        }

        try {
            // I shouldn't need this, but TypeScript's flow-sensitive typing is
            // apparently failing here.
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return body!(attrs)
        } finally {
            currentMask = prevMask
            currentInfo = prevInfo
            currentEnv = prevEnv
            currentCells = prevCells
            currentRemoveTarget = prevRemoveTarget
            currentStateFactory = prevStateFactory

            if (__DEV__) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                currentCellTypes = prevCellTypes!
                currentCellTypeIndex = prevCellTypeIndex
            }
        }
    }

    try {
        Object.defineProperty(Comp, "name", {value: name})
    } catch (e) {
        // ignore to gracefully degrade on IE
    }

    return Comp
}

export function isInitial(): boolean {
    return (currentMask & Bits.IsFirstRun) !== 0
}

// Note: this is a very perf-critical function, as many other functions depend
// on it. It also goes to great lengths to minimize stack usage, it only
// allocates the remove closure if child remove callbacks exist, and it attempts
// to reuse the same closure context where possible/practical.
//
// The state is modeled as two phases:
//
// Live:
// - Number of blocks still closing
// - Child cells
// - Child `whenRemoved` callbacks
// - Parent `onRemove`
// Closed:
// - Number of blocks still closing
// - Parent `onRemove`'s `resolve` function
// - Ignored
// - Ignored
//
// The function itself is structured as five concrete steps:
//
// 1. Set up initial state in preparation for the block
// 1. Invoke the block
// 1. Restore old state
// 1. Clean up after child close (if applicable)
// 1. Schedule removal callback if any child remove callbacks were scheduled
export function guard<T extends Polymorphic>(cond: Any, block: () => T): T {
    if (__DEV__) validateContext(CellType.Guard)

    const parentMask = currentMask
    const parentCells = currentCells
    const prevRemoveTarget = currentRemoveTarget
    let prevStateFactory = currentStateFactory

    currentStateFactory = void 0
    if (parentMask & Bits.IsFirstRun) {
        currentMask = Bits.IsActive | Bits.IsFirstRun | Bits.IsNestedRemove
        parentCells.push(
            1, // close open count
            currentCells = [], // child cells on run, close resolve after closed
            currentRemoveTarget = [],
            void 0 // onRemove
        )
    } else {
        const index = parentMask >>> Bits.IndexOffset
        currentMask = Bits.IsActive | Bits.IsNestedRemove |
            // Intentionally using an implicit coercion here.
            (!!cond as Any as number) << Bits.IsFirstRunOffset
        const removes = currentRemoveTarget =
            parentCells[index + 1] as WhenRemovedCallback[]
        if (removes.length) currentRemoveTarget = parentCells[index + 1] = []
        const cells = currentCells = parentCells[index + 2] as CellList
        if (parentMask & Bits.IsFirstRun) cells.length = 0
    }

    try {
        return block()
    } finally {
        const childMask = currentMask
        const info = currentInfo
        const index = parentMask >>> Bits.IndexOffset
        currentCells = parentCells
        currentRemoveTarget = prevRemoveTarget
        currentMask = parentMask + (4 << Bits.IndexOffset)
        currentStateFactory = prevStateFactory
        let stateFactory: Maybe<StateFactory>

        if (childMask & Bits.IsFirstRun) {
            const childRemoves = parentCells[index + 1] as WhenRemovedCallback[]

            if (childRemoves.length) {
                const result = runClose(info, childRemoves)
                if (result != null) {
                    if (stateFactory == null) {
                        stateFactory = getStateFactory(info, parentCells)
                    }
                    // Add it, then remove it once it resolves.
                    (parentCells[index] as number)++
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    stateFactory(index, StateType.GuardPromise, result!)
                }
            }
        }

        // Run this after, so any applicable pending child removes are also
        // handled.
        if (
            childMask & Bits.HasRemoveCallback ||
            (parentCells[index + 2] as number) > 1
        ) {
            // Better to just update it directly rather than to waste stack
            // space just to avoid a heap access.
            currentMask |= Bits.HasRemoveCallback
            let onRemove = parentCells[index + 3] as Maybe<WhenRemovedCallback>
            if (onRemove == null) {
                if (stateFactory == null) {
                    stateFactory = getStateFactory(info, parentCells)
                }
                parentCells[index + 3] = onRemove =
                    stateFactory(index, StateType.GuardRemove, void 0)
            }

            if (childMask & Bits.IsNestedRemove) {
                (currentRemoveTarget as WhenRemovedCallback[]).push(onRemove)
            } else {
                (currentRemoveTarget as Info).whenRemoved(onRemove)
            }
        }
    }
}

export function useEffect(block: () => Maybe<WhenRemovedCallback>): void
export function useEffect<D extends Any>(
    dependency: D,
    block: () => Maybe<WhenRemovedCallback>
): void
export function useEffect<D extends Any>(
    dependency: D | (() => Maybe<WhenRemovedCallback>),
    block?: () => Maybe<WhenRemovedCallback>
): void {
    if (__DEV__) validateContext(CellType.UseEffect)

    const mask = currentMask
    const cells = currentCells
    const index = mask >>> Bits.IndexOffset
    let callback: Maybe<WhenRemovedCallback>

    if (arguments.length < 2) {
        currentMask = mask + (1 << Bits.IndexOffset)
        if (mask & Bits.IsFirstRun) {
            callback = (dependency as () => Maybe<WhenRemovedCallback>)()
            if (typeof callback !== "function") callback = void 0
            cells.push(callback)
        } else {
            callback = cells[index] as Maybe<WhenRemovedCallback>
        }
    } else {
        currentMask = mask + (2 << Bits.IndexOffset)
        if (mask & Bits.IsFirstRun) {
            callback = (block as () => WhenRemovedCallback)()
            if (typeof callback !== "function") callback = void 0
            cells.push(dependency, callback)
        } else {
            const prev = cells[index] as D
            cells[index] = dependency
            if (isEqual(prev, dependency as D)) {
                callback = cells[index + 1] as Maybe<WhenRemovedCallback>
            } else {
                callback = (block as () => WhenRemovedCallback)()
                if (typeof callback !== "function") callback = void 0
                cells[index + 1] = callback
            }
        }
    }

    if (callback != null) whenRemoved(callback)
}

export function whenEmitted<T extends {}, K extends keyof T>(
    target: EventEmitter<T>,
    name: K,
    callback: (value: T[K], capture: Capture) => void
): void
export function whenEmitted<E extends Event<string>>(
    target: EventTarget<E>,
    name: E["type"],
    callback: (value: E, capture: Capture) => void
): void
export function whenEmitted<
    T extends {}, K extends keyof T,
    E extends Event<string>
>(
    target: EventTarget<E> | EventEmitter<T>,
    name: K | E["type"],
    callback: (value: T[K] | E, capture: Capture) => void
): void {
    if (__DEV__) validateContext(CellType.UseEffect)

    const mask = currentMask
    const cells = currentCells
    const info = currentInfo
    const index = mask >>> Bits.IndexOffset
    const currentIsDOM = "addEventListener" in target
    const stateFactory = getStateFactory(info, cells)
    let handler: ((value: T[K]) => void) | EventListener<EventTarget<E>, E>
    let onRemove: WhenRemovedCallback

    currentMask = mask + (5 << Bits.IndexOffset) | Bits.HasRemoveCallback

    if (mask & Bits.IsFirstRun) {
        if (currentIsDOM) {
            (target as EventTarget<E>).addEventListener<E>(
                name as E["type"],
                handler = stateFactory<E>(
                    index, StateType.WhenEmittedDOMCallback, void 0
                ),
                false
            )
        } else {
            (target as EventEmitter<T>).on(
                name as K,
                handler = stateFactory<T, K>(
                    index, StateType.WhenEmittedNodeCallback, void 0
                )
            )
        }

        cells.push(
            callback,
            target,
            name,
            handler,
            onRemove = stateFactory( // remove
                index,
                currentIsDOM
                    ? StateType.WhenEmittedDOMRemove
                    : StateType.WhenEmittedNodeRemove,
                void 0
            )
        )
    } else {
        const prevTarget = cells[index + 1] as (
            EventTarget<E> | EventEmitter<T>
        )
        const prevName = cells[index + 1] as K | E["type"]
        const prevHandler = cells[index + 2] as (
            | ((value: T[K]) => void)
            | EventListener<EventTarget<E>, E>
        )
        onRemove = cells[index + 4] as WhenRemovedCallback
        let prevIsDOM = "addEventListener" in prevTarget

        cells[index] = callback
        cells[index + 1] = target
        cells[index + 2] = name

        if (target !== prevTarget || name !== prevName) {
            if (currentIsDOM === prevIsDOM) {
                if (currentIsDOM) {
                    (target as EventTarget<E>).removeEventListener(
                        prevName as E["type"],
                        prevHandler as EventListener<EventTarget<E>, E>,
                        false
                    )
                    ;(target as EventTarget<E>).addEventListener(
                        name as E["type"],
                        prevHandler as EventListener<EventTarget<E>, E>,
                        false
                    )
                } else {
                    (target as EventEmitter<T>).off(
                        prevName as K,
                        prevHandler as (value: T[K]) => void
                    )
                    ;(target as EventEmitter<T>).on(
                        name as K,
                        prevHandler as (value: T[K]) => void
                    )
                }
            } else {
                onRemove = cells[index + 4] = stateFactory(
                    index,
                    currentIsDOM
                        ? StateType.WhenEmittedDOMRemove
                        : StateType.WhenEmittedNodeRemove,
                    void 0
                )
                if (currentIsDOM) {
                    (target as EventTarget<E>).addEventListener(
                        name as E["type"],
                        cells[index + 3] = stateFactory<E>(
                            index, StateType.WhenEmittedDOMCallback, void 0
                        ),
                        false
                    )
                } else {
                    (target as EventEmitter<T>).off(
                        name as K,
                        cells[index + 3] = stateFactory<T, K>(
                            index, StateType.WhenEmittedNodeCallback, void 0
                        )
                    )
                }

                if (prevIsDOM) {
                    (prevTarget as EventTarget<E>).removeEventListener(
                        prevName as E["type"],
                        prevHandler as EventListener<EventTarget<E>, E>,
                        false
                    )
                } else {
                    (prevTarget as EventEmitter<T>).off(
                        prevName as K,
                        prevHandler as (value: T[K]) => void
                    )
                }
            }
        }
    }

    whenRemoved(onRemove)
}

export function whenCaught(callback: WhenCaughtCallback) {
    if (__DEV__) validateContext(void 0)
    currentInfo.whenCaught(callback)
}

export function whenReady(callback: WhenReadyCallback) {
    if (__DEV__) validateContext(void 0)
    currentInfo.whenReady(callback)
}

export function whenRemoved(callback: WhenRemovedCallback) {
    if (__DEV__) validateContext(void 0)

    const mask = currentMask
    currentMask = mask | Bits.HasRemoveCallback

    if (mask & Bits.IsNestedRemove) {
        (currentRemoveTarget as WhenRemovedCallback[]).push(callback)
    } else {
        (currentRemoveTarget as Info).whenRemoved(callback)
    }
}

interface IfElseOpts<T extends Any> {
    then(): T
    else(): T
}

// Implemented mostly in userland as it's basically just duplicating `guard`.
export function when<T extends Any>(cond: Any, opts: () => T): T
export function when<T extends Any>(cond: Any, opts: IfElseOpts<T>): T
export function when<T extends Any>(
    cond: Any, opts: Partial<IfElseOpts<T>>
): Maybe<T>
export function when<T extends Any>(
    cond: Any,
    opts: Partial<IfElseOpts<T>> | (() => T)
): Maybe<T> {
    if (__DEV__) validateContext(CellType.When)

    const coerced = !!cond
    const mask = currentMask
    const cells = currentCells
    let changed = true
    let block: Maybe<() => T>

    if (typeof opts === "function") {
        if (coerced) block = opts
    } else {
        block = coerced ? opts.then : opts.else
    }

    currentMask = mask + (1 << Bits.IndexOffset)
    if (mask & Bits.IsFirstRun) {
        cells.push(true)
    } else {
        const index = mask >>> Bits.IndexOffset
        changed = (cells[index] as boolean) !== (cells[index] = coerced)
    }

    return guard(
        changed,
        typeof block === "function" ? block : noop
    )
}

export type Ref<T extends Any> = object & {
    current: T
}

export function ref<T extends Any>(): Ref<T | undefined>
export function ref<T extends Any>(initialValue: T): Ref<T>
export function ref<T extends Any>(initialValue?: T): Ref<T | undefined> {
    if (__DEV__) validateContext(CellType.Ref)

    const mask = currentMask
    currentMask = mask + (1 << Bits.IndexOffset)
    if (mask & Bits.IsFirstRun) {
        const value = {current: initialValue}
        currentCells.push(value)
        return value
    } else {
        return currentCells[mask >>> Bits.IndexOffset] as Ref<T>
    }
}

export function useInfo(): Info {
    if (__DEV__) validateContext(void 0)

    return currentInfo
}

export function useEnv(): Environment {
    if (__DEV__) validateContext(void 0)

    return currentEnv
}

export function setEnv(key: PropertyKey, value: EnvironmentValue): void {
    if (__DEV__) validateContext(void 0)

    currentInfo.setEnv(key, value)
}

/*******************************************/
/*                                         */
/*   D e r i v e d   o p e r a t i o n s   */
/*                                         */
/*******************************************/

export function slot<T extends Any>(
    initialValue: T
): [T, (value: T) => Promise<void>] {
    if (__DEV__) validateContext(CellType.Slot)

    const mask = currentMask
    const cells = currentCells
    const info = currentInfo
    const index = mask >>> Bits.IndexOffset

    currentMask = mask + (1 << Bits.IndexOffset)
    if (mask & Bits.IsFirstRun) cells.push(initialValue)
    else initialValue = cells[index] as T

    return [
        initialValue,
        getStateFactory(info, cells)(index, StateType.Slot, void 0),
    ]
}

export function useReducer<T extends Any, A extends Polymorphic>(
    init: () => T,
    reducer: (prev: T, action: A) => T
): [T, (action: A) => Promise<void>] {
    if (__DEV__) validateContext(CellType.UseReducer)

    const mask = currentMask
    const cells = currentCells
    const info = currentInfo
    const index = mask >>> Bits.IndexOffset
    let value: T

    currentMask = mask + (2 << Bits.IndexOffset)
    if (mask & Bits.IsFirstRun) {
        cells.push(
            value = init(),
            reducer
        )
    } else {
        value = cells[index] as T
        cells[index + 1] = reducer
    }

    return [
        value,
        getStateFactory(info, cells)(index, StateType.Reducer, void 0),
    ]
}

// I wish I had macros here...
export function lazy<T extends Any>(
    init: () => T
): [T, (updater: (value: T) => T) => Promise<void>] {
    if (__DEV__) validateContext(CellType.Lazy)

    const mask = currentMask
    const cells = currentCells
    const info = currentInfo
    const index = mask >>> Bits.IndexOffset
    let value: T

    currentMask = mask + (1 << Bits.IndexOffset)
    if (mask & Bits.IsFirstRun) cells.push(value = init())
    else value = cells[index] as T

    return [
        value,
        getStateFactory(info, cells)(index, StateType.Lazy, void 0),
    ]
}

export function memo<T extends Any>(init: () => T): T
export function memo<T extends Any, D extends Any>(
    dependency: D,
    init: (value: D) => T
): T
export function memo<T extends Any, D extends Any>(
    dependency: D | (() => T),
    init?: (value: D) => T
): T {
    if (__DEV__) validateContext(CellType.Memo)

    const mask = currentMask
    const cells = currentCells
    const index = mask >>> Bits.IndexOffset

    if (arguments.length < 2) {
        currentMask = mask + (1 << Bits.IndexOffset)
        if (mask & Bits.IsFirstRun) {
            const value = (dependency as () => T)()
            cells.push(value)
            return value
        } else {
            return cells[index] as T
        }
    } else {
        currentMask = mask + (2 << Bits.IndexOffset)
        if (mask & Bits.IsFirstRun) {
            const value = (init as (v: D) => T)(dependency as D)
            cells.push(dependency, value)
            return value
        } else {
            const prev = cells[index] as D
            cells[index] = dependency
            if (isEqual(prev, dependency)) {
                return cells[index + 1] as T
            } else {
                return cells[index + 1] = (init as (v: D) => T)(dependency as D)
            }
        }
    }
}

export function usePrevious<T extends Any>(value: T, initial: T): T {
    if (__DEV__) validateContext(CellType.UsePrevious)

    const mask = currentMask
    const cells = currentCells
    const index = mask >>> Bits.IndexOffset

    currentMask = mask + (1 << Bits.IndexOffset)

    if (mask & Bits.IsFirstRun) {
        cells.push(value)
    } else {
        initial = cells[index] as T
        cells[index] = value
    }

    return initial
}

export function useToggle(): [boolean, () => Promise<void>] {
    if (__DEV__) validateContext(CellType.UseToggle)

    const mask = currentMask
    const cells = currentCells
    const info = currentInfo
    const index = mask >>> Bits.IndexOffset
    let value = false

    currentMask = mask + (1 << Bits.IndexOffset)
    if (mask & Bits.IsFirstRun) cells.push(false)
    else value = cells[index] as boolean

    return [
        value,
        getStateFactory(info, cells)(index, StateType.Toggle, void 0)
    ]
}

const enum UseState {
    Pending,
    Ready,
    Error,
}

const StateLookup = ["pending", "ready", "error"] as const
type UseStateKeys = typeof StateLookup

interface UseMatchers<T extends Any, R> {
    pending(): R
    ready(value: T): R
    error(value: ErrorValue): R
}

type Use<T extends Any> =
    | {$: UseState.Pending, _: void} & _UseCommon<T>
    | {$: UseState.Ready, _: T} & _UseCommon<T>
    | {$: UseState.Error, _: ErrorValue} & _UseCommon<T>

type _UseCommon<T extends Any> = {
    state(this: Use<T>): UseStateKeys[(typeof this)["$"]]
    value(this: Use<T>): (typeof this)["_"]
    match<R extends Polymorphic>(this: Use<T>, matchers: UseMatchers<T, R>): R
}

const Use: {
    new<T extends Any>(init?: (signal: AbortSignal) => Await<T>): Use<T>
    prototype: _UseCommon<Any>
} = /*@__PURE__*/ (() => {
function Use<T extends Any>(
    this: Use<T>,
    init?: (signal: AbortSignal) => Await<T>
) {
    const mask = currentMask
    const cells = currentCells
    const info = currentInfo
    const index = mask >>> Bits.IndexOffset
    let onRemove: WhenRemovedCallback

    currentMask = mask + (4 << Bits.IndexOffset) | Bits.HasRemoveCallback
    if (mask & Bits.IsFirstRun) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const controller: AbortController = new info.window!.AbortController()
        const stateFactory = getStateFactory(info, cells)
        cells.push(
            this.$ = UseState.Pending, // state
            this._ = void 0, // value
            onRemove = stateFactory(index, StateType.UseRemove, void 0),
            controller,
        )

        // I'm creating a synthetic promise because it's cheaper than adding
        // `init` to the closure *and* creating a second function.
        stateFactory(
            index,
            StateType.UsePromise,
            Promise.resolve(controller.signal).then(init)
        )
    } else {
        this.$ = cells[index] as UseState
        this._ = cells[index + 1] as Maybe<T | ErrorValue>
        onRemove = cells[index + 2] as WhenRemovedCallback
    }

    if (mask & Bits.IsNestedRemove) {
        (currentRemoveTarget as WhenRemovedCallback[]).push(onRemove)
    } else {
        (currentRemoveTarget as Info).whenRemoved(onRemove)
    }
}

(Use.prototype as _UseCommon<Any>).state = function () {
    return StateLookup[this.$]
}

;(Use.prototype as _UseCommon<Any>).value = function () {
    return this._
}

;(Use.prototype as _UseCommon<Any>).match = function (matchers) {
    if (this.$ === UseState.Pending) {
        return matchers.pending()
    } else if (this.$ === UseState.Ready) {
        return matchers.ready(this._)
    } else /* if (this.$ === UseState.Error) */ {
        return matchers.error(this._)
    }
}

return Use as Any as {
    new<T extends Any>(init?: (signal: AbortSignal) => Await<T>): Use<T>
    prototype: _UseCommon<Any>
}
})()

// `use` is pretty complicated to begin with. Let's not blow this module up
// further by super-optimizing an inherently moderately expensive operation to
// begin with. It's also something mildly perf-sensitive on subsequent runs as
// it handles resource loading, a very common operation in many apps.
export function use<T extends Any>(
    init: (signal: AbortSignal) => Await<T>
): Use<T>
export function use<T extends Any, D extends Any>(
    dependency: D,
    init: (value: D, signal: AbortSignal) => Await<T>
): Use<T>
export function use<T extends Any, D extends Any>(
    dependency: D | ((signal: AbortSignal) => Await<T>),
    init?: (value: D, signal: AbortSignal) => Await<T>
): Use<T> {
    if (__DEV__) validateContext(CellType.Use)

    if (arguments.length < 2) {
        return new Use(dependency as (signal: AbortSignal) => Await<T>)
    } else {
        return guard(hasChanged(dependency), () => new Use((signal) =>
            (init as ((value: D, signal: AbortSignal) => Await<T>))(
                dependency as D,
                signal
            )
        ))
    }
}

export function and(...values: Any[]): boolean
export function and(): boolean {
    let result = 1
    for (let i = 0; i < arguments.length; i++) {
        result &= (!!arguments[i] as Any as number)
    }
    return !!result
}
export {and as _and} // for CoffeeScript/etc.

export function or(...values: Any[]): boolean
export function or(): boolean {
    let result = 0
    for (let i = 0; i < arguments.length; i++) {
        result |= (!!arguments[i] as Any as number)
    }
    return !!result
}
export {or as _or} // for CoffeeScript/etc.

export function isIdentical(a: Any, b: Any) {
    // eslint-disable-next-line no-self-compare
    return a === b || a !== a && b !== b
}

export {isEqual}

export function hasChanged(...values: Any[]): boolean
export function hasChanged(): boolean {
    if (__DEV__) validateContext(CellType.HasChanged)

    const mask = currentMask
    const cells = currentCells
    let index = mask >>> Bits.IndexOffset

    currentMask = mask + (arguments.length << Bits.IndexOffset)
    if (mask & Bits.IsFirstRun) {
        cells.push.apply(cells, arguments)
        return true
    } else {
        let result = 1
        for (let i = 0; i < arguments.length; i++, index++) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            result &= isEqual(cells[index], arguments[i]) as Any as number
            cells[index] = arguments[i]
        }
        return !!result
    }
}

export function hasChangedBy<T extends Any>(
    value: T,
    comparator: (prev: T, next: T) => boolean
): boolean {
    if (__DEV__) validateContext(CellType.HasChangedBy)

    const mask = currentMask
    const cells = currentCells
    let index = mask >>> Bits.IndexOffset

    currentMask = mask + (1 << Bits.IndexOffset)
    if (mask & Bits.IsFirstRun) {
        cells.push(value)
        return true
    } else {
        const prev = cells[index] as T
        cells[index] = value
        return comparator(prev, value)
    }
}
