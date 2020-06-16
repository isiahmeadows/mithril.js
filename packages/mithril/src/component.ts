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

import {noop, assertDevelopment, defer1} from "./internal/util"
import {isEqual} from "./internal/is-equal"
import {
    EventEmitter, EventTarget, Event, EventListener,
    AbortSignal, AbortController,
} from "./internal/dom"
import {
    ComponentAttributesObject, Capture, EventValue,
    Environment, EnvironmentValue, RefValue,
    WhenLayoutResult, WhenLayoutRemovedResult,
    WhenReadyResult, WhenRemovedResult,
    Vnode, Component, ErrorValue, EventListener as VirtualEventListener,

    // For `state`
    VnodeState, StateInit, StateValue, Type, create
} from "./internal/vnode"
import {Use, UseInit, UseState} from "./internal/use"
import {invokeEvent} from "./internal/dom-util"
import {
    CellType, CellTypeTable, CellList, Info, RemoveCallback, RemoveChild
} from "./internal/dsl-common"

/*************************************/
/*                                   */
/*   C o r e   p r i m i t i v e s   */
/*                                   */
/*************************************/

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
//
// -----------------------------------------------------------------------------
//
// You may be wondering why I chose to use chained closures instead of a single
// shared object. Well, this has a reason, too: engines *always* allocate a
// closure parent pointer for every closure, whether you use a shared object or
// not. And this closure parent pointer exists in all but the most contrived
// case where only local variables are accessed. So if you even as much as
// reference a parent closure (as virtually all these do), the reference is
// broken.

// For callbacks that only need the info and/or state, the overhead is skipped,
// as there aren't any memory savings to be gained with the indirection, even
// in the ideal case, and in many simple cases, the intermediate closure doesn't
// even need allocated.

function makeUseEffectRemove(index: number): RemoveChild {
    return (info) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore https://github.com/microsoft/TypeScript/issues/35866
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        (0, info.state![index + 1])()
        return void 0 as Any as WhenRemovedResult
    }
}

function makeGuardRemove(index: number): RemoveChild {
    return (info) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const cells = info.state!

        // Clear out unneeded memory references.
        cells[index + 1] =
        cells[index + 2] =
        cells[index + 3] = void 0
        // If there's nothing to await, let's just skip the ceremony.
        return --(cells[index] as number)
            ? new Promise<WhenRemovedResult>(
                (resolve) => { cells[index + 2] = resolve }
            )
            : void 0 as Any as WhenRemovedResult
    }
}

function makeUseRemove(index: number): RemoveChild {
    return (info) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const cells = info.state!

        const ctrl = cells[index + 3] as AbortController
        cells[index + 2] = cells[index + 3] = void 0
        ctrl.abort()
        return void 0 as Any as WhenRemovedResult
    }
}

function makeWhenEmittedDOMRemove(index: number): RemoveChild {
    return (info) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const cells = info.state!

        type _E = Event<string>
        type _T = EventTarget<_E>
        ;(cells[index + 1] as _T).removeEventListener(
            cells[index + 2] as _E["type"],
            cells[index + 3] as EventListener<_T, _E>,
            false
        )
        return void 0 as Any as WhenRemovedResult
    }
}

function makeWhenEmittedNodeRemove(index: number): RemoveChild {
    return (info) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const cells = info.state!

        ;(cells[index + 1] as EventEmitter<Record<string, Any>>).off(
            cells[index + 2] as string,
            cells[index + 3] as (event: Any) => void
        )
        return void 0 as Any as WhenRemovedResult
    }
}

const enum StateType {
    Slot,
    Lazy,
    Toggle,
    GuardPromise,
    UsePromise,
    Reducer,

    WhenEmittedDOMCallback,
    WhenEmittedNodeCallback,
}

interface StateFactory {
    <T extends Any>(
        index: number,
        type: StateType.Slot,
        p: undefined
    ): (value: T) => Promise<void>
    <T extends Any>(
        index: number,
        type: StateType.Lazy,
        p: undefined
    ): (update: (value: T) => T) => Promise<void>
    (
        index: number,
        type: StateType.Toggle,
        p: undefined
    ): () => Promise<void>
    (
        index: number,
        type: StateType.GuardPromise,
        p: Promise<WhenRemovedResult>
    ): void
    (index: number, type: StateType.UsePromise, p: Promise<Polymorphic>): void

    <T>(
        index: number,
        type: StateType.Reducer,
        p: undefined
    ): (next: T) => Promise<void>

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
        } else if (type === StateType.WhenEmittedDOMCallback) {
            type _E = T & Event<string> & EventValue
            type _T = EventTarget<_E>
            return (event: _E) => {
                invokeEvent(
                    info,
                    cells[index] as VirtualEventListener<_E, _T>,
                    event, event, cells[index + 1] as _T
                )
            }
        } else if (type === StateType.WhenEmittedNodeCallback) {
            type _E = T & EventValue
            return (event: _E) => {
                invokeEvent<_E, _E>(
                    info,
                    cells[index] as VirtualEventListener<_E, _E>,
                    event, void 0, event,
                )
            }
        } else /* if (type === StateType.WhenEmittedNodeRemove) */ {
            return (): WhenRemovedResult => {
                (cells[index + 1] as EventEmitter<Record<string, Any>>).off(
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
let currentRemoveChild: Maybe<RemoveChild[]>
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

// Note: this should only be called in dev mode.
function validateContext(type: Maybe<CellType>) {
    assertDevelopment()

    const mask = currentMask

    if (!mask) {
        throw new TypeError(
            "This must only be used inside a component context."
        )
    }

    if (type != null) {
        if (mask & Bits.IsFirstRun) {
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
    removes: RemoveChild[]
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

type DevCellList = CellList & {componentKind: "dsl"}

export function component<
    A extends ComponentAttributesObject,
    E extends Environment = Environment
>(
    body: (attrs: A) => Vnode
): Component<A, CellList, E>
export function component<
    A extends ComponentAttributesObject,
    E extends Environment = Environment
>(
    name: string,
    body: (attrs: A) => Vnode
): Component<A, CellList, E>
export function component<
    A extends ComponentAttributesObject,
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
        const prevRemoveChild = currentRemoveChild
        const prevStateFactory = currentStateFactory
        let prevCellTypes: Maybe<CellType[]>
        let prevCellTypeIndex = 0

        if (__DEV__) {
            prevCellTypes = currentCellTypes
            prevCellTypeIndex = currentCellTypeIndex
        }

        const cells = info.state

        // Fast path: always set everything.
        currentMask = __DEV__
            ? Bits.IsActive | 1 << Bits.IndexOffset
            : Bits.IsActive
        currentInfo = info
        currentEnv = env
        currentCells = cells as CellList
        currentRemoveChild = currentStateFactory = void 0

        // Slow path: set another variable and allocate the array.
        if (cells == null) {
            currentMask = __DEV__
                ? Bits.IsActive | Bits.IsFirstRun | 1 << Bits.IndexOffset
                : Bits.IsActive | Bits.IsFirstRun
            currentCells = info.state = []

            if (__DEV__) {
                (currentCells as DevCellList).componentKind = "dsl",
                currentCells.push(currentCellTypes = [])
            }
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
            currentRemoveChild = prevRemoveChild
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

    if (__DEV__) {
        // For detection. This metadata is *not* kept inline.
        Comp._devDslRoot = true
    }

    return Comp
}

export function state<E extends Environment = Environment>(
    body: () => Vnode
): VnodeState {
    function init(info: Info, env: E): Vnode {
        const prevMask = currentMask
        const prevInfo = currentInfo
        const prevEnv = currentEnv
        const prevCells = currentCells
        const prevRemoveChild = currentRemoveChild
        const prevStateFactory = currentStateFactory
        let prevCellTypes: Maybe<CellType[]>
        let prevCellTypeIndex = 0

        if (__DEV__) {
            prevCellTypes = currentCellTypes
            prevCellTypeIndex = currentCellTypeIndex
        }

        const cells = info.state

        // Fast path: always set everything.
        currentMask = __DEV__
            ? Bits.IsActive | 1 << Bits.IndexOffset
            : Bits.IsActive
        currentInfo = info
        currentEnv = env
        currentCells = cells as CellList
        currentRemoveChild = currentStateFactory = void 0

        // Slow path: set another variable and allocate the array.
        if (cells == null) {
            currentMask = __DEV__
                ? Bits.IsActive | Bits.IsFirstRun | 1 << Bits.IndexOffset
                : Bits.IsActive | Bits.IsFirstRun
            currentCells = info.state = []

            if (__DEV__) {
                (currentCells as DevCellList).componentKind = "dsl",
                currentCells.push(currentCellTypes = [])
            }
        }

        try {
            return body()
        } finally {
            currentMask = prevMask
            currentInfo = prevInfo
            currentEnv = prevEnv
            currentCells = prevCells
            currentRemoveChild = prevRemoveChild
            currentStateFactory = prevStateFactory

            if (__DEV__) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                currentCellTypes = prevCellTypes!
                currentCellTypeIndex = prevCellTypeIndex
            }
        }
    }

    if (__DEV__) {
        // For detection. This metadata is *not* kept inline.
        init._devDslRoot = true
    }

    return create(Type.State, init as Any as StateInit<StateValue>)
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
// 2. Invoke the block
// 3. Restore old state
// 4. Clean up after child close (if applicable)
// 5. Schedule removal callback if any child remove callbacks were scheduled
function _guard<T extends Polymorphic>(cond: Any, block: () => T): T {
    const parentMask = currentMask
    const parentCells = currentCells
    const prevRemoveChild = currentRemoveChild
    const prevStateFactory = currentStateFactory

    currentStateFactory = void 0
    if (parentMask & Bits.IsFirstRun) {
        currentMask = Bits.IsActive | Bits.IsFirstRun
        parentCells.push(
            1, // close open count
            currentCells = [], // child cells on run, close resolve after closed
            currentRemoveChild = [],
            void 0 // onRemove
        )
    } else {
        const index = parentMask >>> Bits.IndexOffset
        currentMask = Bits.IsActive |
            // Intentionally using an implicit coercion here.
            (!!cond as Any as number) << Bits.IsFirstRunOffset
        const removes = currentRemoveChild =
            parentCells[index + 1] as RemoveChild[]
        if (removes.length) currentRemoveChild = parentCells[index + 1] = []
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
        currentRemoveChild = prevRemoveChild
        currentMask = parentMask + (4 << Bits.IndexOffset)
        currentStateFactory = prevStateFactory
        let stateFactory: Maybe<StateFactory>

        if (childMask & Bits.IsFirstRun) {
            const childRemoves = parentCells[index + 1] as RemoveChild[]

            if (childRemoves.length) {
                const result = runClose(info, childRemoves)
                if (result != null) {
                    if (stateFactory == null) {
                        stateFactory = getStateFactory(info, parentCells)
                    }
                    // Add it, then remove it once it resolves.
                    (parentCells[index] as number)++
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    stateFactory(index, StateType.GuardPromise, result)
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
            let onRemove = parentCells[index + 3] as Maybe<RemoveChild>
            if (onRemove == null) {
                parentCells[index + 3] = onRemove = makeGuardRemove(index)
            }

            if (prevRemoveChild != null) prevRemoveChild.push(onRemove)
        }
    }
}

export function guard<T extends Polymorphic>(cond: Any, block: () => T): T {
    if (__DEV__) validateContext(CellType.Guard)
    return _guard(cond, block)
}

export function useEffect(block: () => Maybe<RemoveCallback>): void
export function useEffect<D extends Any>(
    dependency: D,
    block: () => Maybe<RemoveCallback>
): void
export function useEffect<D extends Any>(
    dependency: D | (() => Maybe<RemoveCallback>),
    block?: () => Maybe<RemoveCallback>
): void {
    if (__DEV__) validateContext(CellType.UseEffect)

    const mask = currentMask
    const cells = currentCells
    const index = mask >>> Bits.IndexOffset
    let callback: Maybe<RemoveCallback>

    if (arguments.length < 2) {
        currentMask = mask + (1 << Bits.IndexOffset)
        if (mask & Bits.IsFirstRun) {
            callback = (dependency as () => Maybe<RemoveCallback>)()
            if (typeof callback !== "function") callback = void 0
            cells.push(callback)
        } else {
            callback = cells[index] as Maybe<RemoveCallback>
        }
    } else {
        currentMask = mask + (2 << Bits.IndexOffset)
        if (mask & Bits.IsFirstRun) {
            callback = (block as () => RemoveCallback)()
            if (typeof callback !== "function") callback = void 0
            cells.push(dependency, callback)
        } else {
            const prev = cells[index] as D
            cells[index] = dependency
            if (isEqual(prev, dependency as D)) {
                callback = cells[index + 1] as Maybe<RemoveCallback>
                cells[index + 1] = void 0
            } else {
                callback = (block as () => RemoveCallback)()
                if (typeof callback !== "function") callback = void 0
                cells[index + 1] = callback
            }
        }
    }

    currentMask |= Bits.HasRemoveCallback

    if (callback != null) {
        const info = currentInfo
        const removeChild = currentRemoveChild
        const wrapped = makeUseEffectRemove(index)
        if (removeChild != null) removeChild.push(wrapped)
        info.whenRemoved(wrapped)
    }
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
    let onRemove: RemoveChild

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
            onRemove = makeWhenEmittedDOMRemove(index)
        } else {
            (target as EventEmitter<T>).on(
                name as K,
                handler = stateFactory<T, K>(
                    index, StateType.WhenEmittedNodeCallback, void 0
                )
            )
            onRemove = makeWhenEmittedNodeRemove(index)
        }

        cells.push(
            callback,
            target,
            name,
            handler,
            onRemove
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
        onRemove = cells[index + 4] as RemoveChild
        const prevIsDOM = "addEventListener" in prevTarget

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
                if (currentIsDOM) {
                    onRemove = cells[index + 4] =
                        makeWhenEmittedDOMRemove(index)
                    ;(target as EventTarget<E>).addEventListener(
                        name as E["type"],
                        cells[index + 3] = stateFactory<E>(
                            index, StateType.WhenEmittedDOMCallback, void 0
                        ),
                        false
                    )
                } else {
                    onRemove = cells[index + 4] =
                        makeWhenEmittedNodeRemove(index)
                    ;(target as EventEmitter<T>).off(
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

    currentMask |= Bits.HasRemoveCallback
    if (currentRemoveChild != null) currentRemoveChild.push(onRemove)
    currentInfo.whenRemoved(onRemove)
}

export function whenLayout(
    callback: (ref: RefValue) => Await<WhenLayoutResult>
) {
    if (__DEV__) validateContext(void 0)
    currentInfo.whenLayout((ref) => callback(ref))
}

export function whenLayoutRemoved(
    callback: (ref: RefValue) => Await<WhenLayoutRemovedResult>
) {
    if (__DEV__) validateContext(void 0)
    currentInfo.whenLayoutRemoved((ref) => callback(ref))
}

export function whenReady(callback: () => Await<WhenReadyResult>) {
    if (__DEV__) validateContext(void 0)
    currentInfo.whenReady(() => callback())
}

export function whenRemoved(callback: RemoveCallback) {
    if (__DEV__) validateContext(void 0)
    const wrapped = () => callback()

    currentMask |= Bits.HasRemoveCallback
    if (currentRemoveChild != null) currentRemoveChild.push(wrapped)
    currentInfo.whenRemoved(wrapped)
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

    return _guard(
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

// `use` is pretty complicated to begin with. Let's not blow this module up
// further by super-optimizing an inherently moderately expensive operation to
// begin with. It's also something mildly perf-sensitive on subsequent runs as
// it handles resource loading, a very common operation in many apps, but the
// creation itself is not.
function _use<T extends Polymorphic>(init: UseInit<T>): Use<T> {
    const mask = currentMask
    const cells = currentCells
    const info = currentInfo
    const index = mask >>> Bits.IndexOffset
    let onRemove: RemoveChild
    let state: UseState
    let value: Use<T>["_"]

    currentMask = mask + (4 << Bits.IndexOffset) | Bits.HasRemoveCallback
    if (mask & Bits.IsFirstRun) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const controller: AbortController = new info.window!.AbortController()
        cells.push(
            state = UseState.Pending, // state
            value = void 0, // value
            onRemove = makeUseRemove(index),
            controller,
        )

        getStateFactory(info, cells)(
            index,
            StateType.UsePromise,
            // This inner function only contains the initializer function + the
            // abort controller, and it's not going to be persisted after the
            // next tick.
            defer1(init, controller.signal)
        )
    } else {
        state = cells[index] as UseState
        value = cells[index + 1] as Maybe<T | ErrorValue>
        onRemove = cells[index + 2] as RemoveChild
    }

    if (currentRemoveChild != null) currentRemoveChild.push(onRemove)
    info.whenRemoved(onRemove)

    return new Use(state, value)
}

export function use<T extends Polymorphic, D extends Any>(
    dependency: D | UseInit<T>,
    init: Maybe<(value: D, signal: AbortSignal) => Await<T>>
): Use<T> {
    if (__DEV__) validateContext(CellType.Use)

    if (arguments.length < 2) {
        return _use(dependency as UseInit<T>)
    } else {
        return _guard(hasChanged(dependency), () => _use(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            (signal) => init!(dependency as D, signal)
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
    const index = mask >>> Bits.IndexOffset

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
