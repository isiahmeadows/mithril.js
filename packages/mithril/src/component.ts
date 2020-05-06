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

import {noop} from "./internal/util"
import {isEqual} from "./internal/is-equal"
import {AbortSignal, AbortController} from "./internal/dom"
import {
    VnodeAttributes,
    ComponentInfo, Environment, EnvironmentValue,
    WhenReadyResult, WhenRemovedResult, WhenRemovedCallback, CloseCallback,
    Vnode, Component, ErrorValue, RenderTarget
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

let currentMask: number = Bits.NotActive
let currentInfo: Info
let currentEnv: Environment
let currentCells: CellList
let currentRemoveTarget: RemoveTarget

// Note: this should only be called in dev mode.
function validateContext() {
    if (!currentMask) {
        throw new TypeError(
            "This must only be used inside a component context."
        )
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
//
// This specifically limits itself to
export function guard<T>(cond: Any, block: () => T): T {
    if (__DEV__) validateContext()
    const parentMask = currentMask
    const parentCells = currentCells
    const prevRemoveTarget = currentRemoveTarget

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

        if (childMask & Bits.IsFirstRun) {
            const childRemoves = parentCells[index + 1] as WhenRemovedCallback[]

            if (childRemoves.length) {
                const result = runClose(info, childRemoves)
                if (result != null) {
                    // Add it, then remove it once it resolves.
                    (parentCells[index] as number)++
                    ;(result as PromiseLike<WhenRemovedResult>).then(() => {
                        if (!--(parentCells[index] as number)) {
                            (parentCells[index + 2] as () => void)()
                        }
                    }, (e: ErrorValue) => {
                        if (!--(parentCells[index] as number)) {
                            (parentCells[index + 2] as () => void)()
                        }
                        info.throw(e, false)
                    })
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
                parentCells[index + 3] = onRemove = () => {
                    const removes = parentCells[index + 2] as
                        WhenRemovedCallback[]
                    // Clear out unneeded memory references.
                    parentCells[index + 1] =
                    parentCells[index + 2] =
                    parentCells[index + 3] = void 0
                    // If there's nothing to await, let's just skip the
                    // ceremony.
                    if (--(parentCells[index] as number)) {
                        const p = new Promise<WhenRemovedResult>((resolve) => {
                            parentCells[index + 2] = resolve
                        })
                        if (!removes.length) return p
                        removes.push(() => p)
                    } else if (!removes.length) {
                        return void 0 as Any as WhenRemovedResult
                    }
                    return runClose(info, removes) as Any as WhenRemovedResult
                }
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
    if (__DEV__) validateContext()
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

export function whenRemoved(callback: () => Await<WhenRemovedResult>) {
    if (__DEV__) validateContext()
    const mask = currentMask
    currentMask = mask | Bits.HasRemoveCallback
    if (mask & Bits.IsNestedRemove) {
        (currentRemoveTarget as WhenRemovedCallback[]).push(callback)
    } else {
        (currentRemoveTarget as Info).whenRemoved(callback)
    }
}

interface IfElseOpts<T> {
    then(): T
    else(): T
}

// Implemented mostly in userland as it's basically just duplicating `guard`.
export function when<T>(cond: Any, opts: () => T): T
export function when<T>(cond: Any, opts: IfElseOpts<T>): T
export function when<T>(
    cond: Any, opts: Partial<IfElseOpts<T>>
): Maybe<T>
export function when<T>(
    cond: Any,
    opts: Partial<IfElseOpts<T>> | (() => T)
): Maybe<T> {
    if (__DEV__) validateContext()
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

export function usePortal(
    target: RenderTarget | (() => RenderTarget),
    ...children: Vnode[]
): void {
    if (__DEV__) validateContext()
    const mask = currentMask
    const cells = currentCells
    const info = currentInfo
    const index = mask >>> Bits.IndexOffset
    let onRemove: WhenRemovedCallback

    currentMask = mask + (5 << Bits.IndexOffset) | Bits.HasRemoveCallback
    if (mask & Bits.IsFirstRun) {
        cells.push(
            void 0, // target
            void 0, // children
            void 0, // child info
            void 0, // init promise
            onRemove = () =>
                (cells[index + 3] as Promise<CloseCallback>)
                    .then((close) => close()) as Any as WhenRemovedResult
        )
    } else {
        onRemove = cells[index + 4] as WhenRemovedCallback
    }

    cells[index + 1] = children
    if (mask & Bits.IsNestedRemove) {
        (currentRemoveTarget as WhenRemovedCallback[]).push(onRemove)
    } else {
        (currentRemoveTarget as Info).whenRemoved(onRemove)
    }

    // Defer the update, so things get queued correctly and so in the event a
    // ref needs rendered to, this can still be up to the task.
    info.whenReady((): Await<WhenReadyResult> => {
        const resolved = typeof target === "function"
            ? target()
            : target

        if (cells[index] === resolved) {
            return (
                (cells[index + 2] as Maybe<ComponentInfo<never>>)?.redraw()
            ) as Any as Promise<WhenReadyResult>
        }

        return (
            cells[index + 3] = info.render<never>(
                cells[index] = resolved,
                (childInfo) => {
                    cells[index + 2] = childInfo
                    return cells[index + 1] as Vnode
                }
            )
        ) as Any as Promise<WhenReadyResult>
    })
}

export type Ref<T> = object & {
    current: T
}

export function ref<T>(): Ref<T | undefined>
export function ref<T>(initialValue: T): Ref<T>
export function ref<T>(initialValue?: T): Ref<T | undefined> {
    if (__DEV__) validateContext()
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
    if (__DEV__) validateContext()
    return currentInfo
}

export function useEnv(): Environment {
    if (__DEV__) validateContext()
    return currentEnv
}

export function setEnv(key: PropertyKey, value: EnvironmentValue): void {
    if (__DEV__) validateContext()
    currentInfo.set(key, value)
}

/*******************************************/
/*                                         */
/*   D e r i v e d   o p e r a t i o n s   */
/*                                         */
/*******************************************/
export function component<
    A extends VnodeAttributes,
    E extends Environment = Environment
>(
    body: (attrs: A) => Vnode
): Component<A, CellList, E>
export function component<
    A extends VnodeAttributes,
    E extends Environment = Environment
>(
    name: string,
    body: (attrs: A) => Vnode
): Component<A, CellList, E>
export function component<
    A extends VnodeAttributes,
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
        const cells = info.state

        // Fast path: always set everything.
        currentMask = Bits.IsActive
        currentInfo = info
        currentEnv = env
        currentCells = cells as CellList[]
        currentRemoveTarget = info

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

export function slot<T extends Any>(
    initialValue: T
): [T, (value: T) => Promise<void>] {
    if (__DEV__) validateContext()
    const mask = currentMask
    const cells = currentCells
    const info = currentInfo
    const index = mask >>> Bits.IndexOffset

    currentMask = mask + (1 << Bits.IndexOffset)
    if (mask & Bits.IsFirstRun) cells.push(initialValue)
    else initialValue = cells[index] as T

    return [initialValue, (next: T): Promise<void> => {
        cells[index] = next
        return info.redraw()
    }]
}

export function useReducer<T extends Any, A extends Any>(
    init: () => T,
    reducer: (prev: T, action: A) => T
): [T, (action: A) => Promise<void>] {
    if (__DEV__) validateContext()
    const mask = currentMask
    const cells = currentCells
    const info = currentInfo
    const index = mask >>> Bits.IndexOffset
    let value: T

    currentMask = mask + (1 << Bits.IndexOffset)
    if (mask & Bits.IsFirstRun) cells.push(value = init())
    else value = cells[index] as T

    return [value, (next: A): Promise<void> => {
        cells[index] = reducer(cells[index] as T, next)
        return info.redraw()
    }]
}

// I wish I had macros here...
export function lazy<T extends Any>(
    init: () => T
): [T, (updater: (value: T) => T) => Promise<void>] {
    if (__DEV__) validateContext()
    const mask = currentMask
    const cells = currentCells
    const info = currentInfo
    const index = mask >>> Bits.IndexOffset
    let value: T

    currentMask = mask + (1 << Bits.IndexOffset)
    if (mask & Bits.IsFirstRun) cells.push(value = init())
    else value = cells[index] as T

    return [value, (update: (value: T) => T): Promise<void> => {
        cells[index] = update(cells[index] as T)
        return info.redraw()
    }]
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
    if (__DEV__) validateContext()
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
    if (__DEV__) validateContext()
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
    if (__DEV__) validateContext()
    const [value, setValue] = slot<boolean>(false)
    return [value, () => setValue(true)]
}

const enum UseState {
    Pending,
    Ready,
    Error,
}

const StateLookup = ["pending", "ready", "error"] as const
type UseStateKeys = typeof StateLookup

interface UseMatchers<T, R> {
    pending(): R
    ready(value: T): R
    error(value: ErrorValue): R
}

type Use<T> =
    | {$: UseState.Pending, _: void} & _UseCommon<T>
    | {$: UseState.Ready, _: T} & _UseCommon<T>
    | {$: UseState.Error, _: ErrorValue} & _UseCommon<T>

type _UseCommon<T> = {
    state(this: Use<T>): UseStateKeys[(typeof this)["$"]]
    value(this: Use<T>): (typeof this)["_"]
    match<R>(this: Use<T>, matchers: UseMatchers<T, R>): R
}

const Use: {
    new<T>(init?: (signal: AbortSignal) => Await<T>): Use<T>
    prototype: _UseCommon<Any>
} = /*@__PURE__*/ (() => {
function Use<T>(this: Use<T>, init?: (signal: AbortSignal) => Await<T>) {
    const mask = currentMask
    const cells = currentCells
    const info = currentInfo
    const index = mask >>> Bits.IndexOffset
    let onRemove: WhenRemovedCallback

    currentMask = mask + (3 << Bits.IndexOffset) | Bits.HasRemoveCallback
    if (mask & Bits.IsFirstRun) {
        let controller: Maybe<AbortController> =
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                new info.window!.AbortController()
        cells.push(
            this.$ = UseState.Pending, // state
            this._ = void 0, // value
            onRemove = () => {
                cells[index + 2] = void 0
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const ctrl = controller!
                controller = void 0
                ctrl.abort()
                return void 0 as Any as WhenRemovedResult
            }
        )

        // I'm creating a synthetic promise because it's cheaper than adding
        // `init` to the closure *and* creating a second function.
        Promise.resolve(controller.signal).then(init).then(
            (v) => {
                cells[index] = UseState.Ready
                cells[index + 1] = v as Any
                info.redraw()
            },
            (e) => {
                cells[index] = UseState.Error
                cells[index + 1] = e
                info.redraw()
            }
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
    new<T>(init?: (signal: AbortSignal) => Await<T>): Use<T>
    prototype: _UseCommon<Any>
}
})()

// `use` is pretty complicated to begin with. Let's not blow this module up
// further by super-optimizing an inherently moderately expensive operation to
// begin with. It's also something mildly perf-sensitive on subsequent runs as
// it handles resource loading, a very common operation in many apps.
export function use<T>(
    init: (signal: AbortSignal) => Await<T>
): Use<T>
export function use<T, D extends Any>(
    dependency: D,
    init: (value: D, signal: AbortSignal) => Await<T>
): Use<T>
export function use<T, D extends Any>(
    dependency: D | ((signal: AbortSignal) => Await<T>),
    init?: (value: D, signal: AbortSignal) => Await<T>
): Use<T> {
    if (__DEV__) validateContext()
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

export function hasChanged(...values: Any[]): boolean
export function hasChanged(): boolean {
    if (__DEV__) validateContext()
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
    if (__DEV__) validateContext()
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
