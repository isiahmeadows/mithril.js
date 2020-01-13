/* eslint-disable no-bitwise */
// Note: this is *very* heavily optimized for speed, not size. It uses a lot of
// hand-rolled and duplicated logic and tries heavily to not use up memory, to
// minimize computational overhead of the DSL, including by taking steps to
// prefer array allocation and avoiding object allocation where possible/
// practical. Everything here is perf-sensitive for the user.
//
// If I had dependent types + induction, this would be so much easier to verify.

import {isEqual} from "./internal/is-equal"
import {AbortSignal, AbortController} from "./internal/dom"
import {
    VnodeAttributes,
    ComponentInfo, Environment, EnvironmentValue,
    WhenRemovedResult, WhenRemovedCallback, Vnode, Component,
    ErrorValue, RenderTarget, StateValue, CloseCallback
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
let currentInfo: Maybe<Info>
let currentEnv: Maybe<Environment>
let currentCells: Maybe<CellList>
let currentRemoveTarget: Maybe<RemoveTarget>

function runClose(
    info: Info,
    removes: WhenRemovedCallback[]
): Maybe<Promise<WhenRemovedResult>> {
    // Wait for all to settle - doesn't matter what the result is.
    let open = 1
    let resolve: Maybe<() => void>

    function onResolve() {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (!--open) resolve!()
    }

    function onReject(e: ErrorValue) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (!--open) resolve!()
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

function bindBranchCleanup(
    cells: CellList, index: number, info: Info
): WhenRemovedCallback {
    return () => {
        cells[index + 5] = void 0
        const removes = cells[index + 2] as WhenRemovedCallback[]
        return (
            removes.length ? runClose(info, removes) : void 0
        ) as Any as WhenRemovedResult
    }
}

function performBranchCreate<T>(
    cells: CellList, prevMask: number, block: () => T
) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const info = currentInfo!
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const prevRemoveTarget = currentRemoveTarget!

    cells.push(
        currentCells = [],
        currentRemoveTarget = [],
        1, // close open count
        void 0, // close resolve
        void 0, // onRemove
        bindBranchCleanup(cells, prevMask >>> Bits.IndexOffset, info)
    )
    currentMask = Bits.IsNestedRemove | Bits.IsActive

    try {
        return block()
    } finally {
        resolveProxyRemove(cells, prevMask, prevRemoveTarget)
    }
}

function addToCloseList<T>(
    cells: CellList,
    info: Info,
    index: number,
    value: Await<T>
) {
    if (value != null) {
        // Add it, then remove it once it resolves.
        (cells[index] as number)++
        ;(value as PromiseLike<T>).then(() => {
            if (!--(cells[index] as number)) {
                (cells[index + 1] as () => void)()
            }
        }, (e: ErrorValue) => {
            if (!--(cells[index] as number)) {
                (cells[index + 1] as () => void)()
            }
            info.throw(e, false)
        })
    }
}

function scheduleCloseRemove(cells: CellList, index: number) {
    if ((cells[index] as number) > 1) {
        let onRemove = cells[index + 2] as Maybe<WhenRemovedCallback>
        if (onRemove == null) {
            cells[index + 2] = onRemove = () => {
                cells[index + 2] = void 0
                // If there's nothing to await, let's just skip the ceremony.
                if (!--(cells[index] as number)) {
                    return void 0 as Any as WhenRemovedResult
                }
                return new Promise<WhenRemovedResult>((resolve) => {
                    cells[index + 1] = resolve
                })
            }
        }

        const mask = currentMask
        currentMask = mask | Bits.HasRemoveCallback
        if (mask & Bits.IsNestedRemove) {
            (currentRemoveTarget as WhenRemovedCallback[]).push(onRemove)
        } else {
            (currentRemoveTarget as Info).whenRemoved(onRemove)
        }
    }
}

function resolveBranch(
    prevCells: CellList, index: number, changed: boolean
) {
    if (changed) {
        const childRemoves = prevCells[index + 1] as WhenRemovedCallback[]

        if (childRemoves.length) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const info = currentInfo!
            addToCloseList(prevCells, info, index + 2,
                runClose(info, childRemoves)
            )
        }
    }

    scheduleCloseRemove(prevCells, index)
}

function performBranchUpdate<T>(
    prevCells: CellList, prevMask: number, changed: boolean, block: () => T
) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const prevRemoveTarget = currentRemoveTarget!
    const index = prevMask >>> Bits.IndexOffset
    const childCells = currentCells = prevCells[index] as CellList
    const childRemoves = prevCells[index + 1] as WhenRemovedCallback[]
    currentMask = Bits.IsActive | Bits.IsNestedRemove |
        // Intentionally using an implicit coercion here.
        (changed as Any as number) << Bits.IsFirstRunOffset

    if (changed) childCells.length = 0
    currentRemoveTarget = childRemoves.length ? [] : childRemoves

    try {
        return block()
    } finally {
        resolveProxyRemove(prevCells, prevMask, prevRemoveTarget)
        resolveBranch(prevCells, index, changed)
    }
}

function resolveProxyRemove(
    prevCells: CellList,
    prevMask: number,
    prevRemoveTarget: RemoveTarget
) {
    const childMask = currentMask
    currentCells = prevCells
    currentRemoveTarget = prevRemoveTarget
    currentMask = (prevMask + (6 << Bits.IndexOffset)) |
        childMask & Bits.HasRemoveCallback

    if (childMask & Bits.HasRemoveCallback) {
        if (childMask & Bits.IsNestedRemove) {
            (prevRemoveTarget as WhenRemovedCallback[]).push(
                prevCells[
                    (prevMask >>> Bits.IndexOffset) + 5
                ] as WhenRemovedCallback
            )
        } else {
            (prevRemoveTarget as Info).whenRemoved(
                prevCells[
                    (prevMask >>> Bits.IndexOffset) + 5
                ] as WhenRemovedCallback
            )
        }
    }
}

interface IfElseOpts<T> {
    then(): T
    else(): T
}

export function when<T>(cond: Any, opts: () => T): T
export function when<T>(cond: Any, opts: IfElseOpts<T>): T
export function when<T>(
    cond: Any, opts: Partial<IfElseOpts<T>>
): Maybe<T>
export function when<T>(
    cond: Any,
    opts: Partial<IfElseOpts<T>> | (() => T)
): Maybe<T> {
    const coerced = !!cond
    let block: Maybe<() => T>

    if (typeof opts === "function") {
        if (coerced) block = opts
    } else {
        block = coerced ? opts.then : opts.else
    }

    const prevMask = currentMask
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const prevCells = currentCells!

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    if (typeof block === "function") {
        if (prevMask & Bits.IsFirstRun) {
            prevCells.push(coerced)
            return performBranchCreate(
                prevCells, prevMask + (1 << Bits.IndexOffset), block
            )
        } else {
            const index = prevMask >>> Bits.IndexOffset
            const prevCond = prevCells[index]
            prevCells[index] = coerced
            return performBranchUpdate(
                prevCells, prevMask + (1 << Bits.IndexOffset),
                prevCond !== coerced, block
            )
        }
    } else {
        // If no branch needs taken, let's avoid most of the excess boilerplate
        // by skipping the usual try/catch block and such.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const info = currentInfo!
        const index = prevMask >>> Bits.IndexOffset

        currentMask = prevMask + (7 << Bits.IndexOffset)
        if (prevMask & Bits.IsFirstRun) {
            prevCells.push(
                coerced,
                [], // current cells
                [], // current remove target
                1, // close open count
                void 0, // close resolve
                void 0, // onRemove
                bindBranchCleanup(prevCells, index + 1, info)
            )
        } else {
            const prevCond = prevCells[index + 6]
            prevCells[index + 6] = coerced
            const changed = prevCond !== coerced
            ;(prevCells[index] as CellList).length = 0
            resolveBranch(prevCells, index + 1, changed)
        }

        return void 0
    }
}

export function guard<T>(cond: Any, block: () => T): T {
    const prevMask = currentMask

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    if (prevMask & Bits.IsFirstRun) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return performBranchCreate(currentCells!, prevMask, block)
    } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return performBranchUpdate(currentCells!, prevMask, !!cond, block)
    }
}

// TODO: lower this to primitives
export function useEffect(block: () => WhenRemovedCallback): void
export function useEffect(
    dependency: Any,
    block: () => WhenRemovedCallback
): void
export function useEffect(
    dependency: Any,
    block?: () => WhenRemovedCallback
): void {
    const prevMask = currentMask

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    if (block == null) {
        whenRemoved(memo(dependency as () => WhenRemovedCallback))
    } else {
        guard(dependency, () => { whenRemoved(memo(block)) })
    }
}

export function whenRemoved(callback: () => Await<WhenRemovedResult>) {
    const mask = currentMask

    if (!mask) {
        throw new TypeError("This must be called inside a component context.")
    }

    currentMask = mask | Bits.HasRemoveCallback
    if (mask & Bits.IsNestedRemove) {
        (currentRemoveTarget as WhenRemovedCallback[]).push(callback)
    } else {
        (currentRemoveTarget as Info).whenRemoved(callback)
    }
}

function initializePortal(
    cells: CellList, index: number, info: Info, target: RenderTarget
) {
    info.render<StateValue>(target, (info) => {
        cells[index + 2] = info
        return cells[index + 1] as Vnode
    }).then(
        (close) => {
            if (cells[index] === target) {
                cells[index + 3] = close
            } else {
                close().catch((e) => { info.throw(e as ErrorValue, false) })
            }
        },
        (e) => { info.throw(e as ErrorValue, true) }
    )
}

export function usePortal(
    target: RenderTarget,
    ...children: Vnode[]
): void
export function usePortal(target: RenderTarget): void {
    const mask = currentMask
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cells = currentCells!
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const info = currentInfo!
    const index = mask >>> Bits.IndexOffset

    if (!mask) {
        throw new TypeError("This must be called inside a component context.")
    }

    currentMask = (mask + (8 << Bits.IndexOffset)) | Bits.HasRemoveCallback
    if (mask & Bits.IsFirstRun) {
        cells.push(
            void 0, // target
            void 0, // children
            void 0, // child info
            // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
            // @ts-ignore https://github.com/microsoft/TypeScript/issues/35866
            () => {
                const closeCallback = cells[index + 3] as Maybe<CloseCallback>
                cells[index + 4] = undefined
                return closeCallback != null ? closeCallback() : void 0
            },
            void 0, // child close
            1, // close open count
            void 0, // close resolve
            void 0 // onRemove
        )
    }

    if (currentMask & Bits.IsNestedRemove) {
        (currentRemoveTarget as WhenRemovedCallback[]).push(
            cells[index + 4] as WhenRemovedCallback
        )
    } else {
        (currentRemoveTarget as Info).whenRemoved(
            cells[index + 4] as WhenRemovedCallback
        )
    }

    const children = [] as Vnode[]
    for (let i = 1; i < arguments.length; i++) {
        children.push(arguments[i] as Vnode)
    }

    const prevTarget = cells[index] as RemoveTarget
    cells[index] = target
    cells[index + 1] = children

    if (mask & Bits.IsFirstRun) {
        initializePortal(cells, index, info, target)
    } else {
        if (prevTarget !== target) {
            const closeCallback = cells[index + 3] as Maybe<CloseCallback>
            initializePortal(cells, index, info, target)
            if (closeCallback) {
                addToCloseList(cells, info, index + 5, closeCallback())
            }
        }

        scheduleCloseRemove(cells, index + 5)
        const childInfo = cells[index + 2] as Maybe<ComponentInfo<StateValue>>
        if (childInfo != null) {
            childInfo.redraw().catch((e) => {
                info.throw(e as ErrorValue, true)
            })
        }
    }
}

export type Ref<T> = object & {
    current: T
}

export function ref<T>(initialValue: T): Ref<T> {
    const prevMask = currentMask

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    currentMask = prevMask + (1 << Bits.IndexOffset)
    if (prevMask & Bits.IsFirstRun) {
        const value = {current: initialValue}
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        currentCells!.push(value)
        return value
    } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return currentCells![prevMask >>> Bits.IndexOffset] as Ref<T>
    }
}

export function useInfo(): Info {
    if (!currentMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return currentInfo!
}

export function useEnv(): Environment {
    if (!currentMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return currentEnv!
}

export function setEnv(key: PropertyKey, value: EnvironmentValue): void {
    if (!currentMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    currentInfo!.set(key, value)
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

        currentInfo = info
        currentEnv = env
        currentRemoveTarget = info

        if (info.state == null) {
            currentMask = Bits.IsActive | Bits.IsFirstRun
            currentCells = info.state = []
        } else {
            currentMask = Bits.IsActive
            currentCells = info.state
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
    return !!(currentMask & Bits.IsFirstRun)
}

export function slot<T extends Any>(
    initialValue: T
): [T, (value: T) => Promise<void>] {
    const prevMask = currentMask
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cells = currentCells!
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const info = currentInfo!
    const index = prevMask >>> Bits.IndexOffset

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    currentMask = prevMask + (1 << Bits.IndexOffset)
    if (prevMask & Bits.IsFirstRun) {
        cells.push(initialValue)
    } else {
        initialValue = cells[index] as T
    }

    return [initialValue, (next: T): Promise<void> => {
        cells[index] = next
        return info.redraw()
    }]
}

export function useReducer<T extends Any, A extends Any>(
    init: () => T,
    reducer: (prev: T, action: A) => T
): [T, (action: A) => Promise<void>] {
    const prevMask = currentMask
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cells = currentCells!
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const info = currentInfo!
    const index = prevMask >>> Bits.IndexOffset
    let value: T

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    currentMask = prevMask + (1 << Bits.IndexOffset)
    if (prevMask & Bits.IsFirstRun) {
        cells.push(value = init())
    } else {
        value = cells[index] as T
    }

    return [value, (next: A): Promise<void> => {
        cells[index] = reducer(cells[index] as T, next)
        return info.redraw()
    }]
}

// I wish I had macros here...
export function lazy<T extends Any>(
    init: () => T
): [T, (updater: (value: T) => T) => Promise<void>] {
    const prevMask = currentMask
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cells = currentCells!
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const info = currentInfo!
    const index = prevMask >>> Bits.IndexOffset
    let value: T

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    currentMask = prevMask + (1 << Bits.IndexOffset)
    if (prevMask & Bits.IsFirstRun) {
        cells.push(value = init())
    } else {
        value = cells[index] as T
    }

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
    const prevMask = currentMask
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cells = currentCells!
    const index = prevMask >>> Bits.IndexOffset

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    if (init == null) {
        currentMask = prevMask + (1 << Bits.IndexOffset)
        if (prevMask & Bits.IsFirstRun) {
            const value = (dependency as () => T)()
            cells.push(value)
            return value
        } else {
            return cells[index] as T
        }
    } else {
        currentMask = prevMask + (2 << Bits.IndexOffset)
        if (prevMask & Bits.IsFirstRun) {
            const value = init(dependency as D)
            cells.push(dependency)
            cells.push(value)
            return value
        } else {
            const prev = cells[index] as D
            cells[index] = dependency
            if (isEqual(prev, dependency as D)) {
                return cells[index + 1] as T
            } else {
                return cells[index + 1] = init(dependency as D)
            }
        }
    }
}

export function usePrevious<T extends Any>(value: T, initial: T): T {
    const prevMask = currentMask
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cells = currentCells!

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    currentMask = prevMask + (1 << Bits.IndexOffset)
    if (prevMask & Bits.IsFirstRun) {
        cells.push(value)
    } else {
        const index = prevMask >>> Bits.IndexOffset
        initial = cells[index] as T
        cells[index] = value
    }

    return initial
}

export function useToggle(): [boolean, () => Promise<void>] {
    const prevMask = currentMask
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cells = currentCells!
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const info = currentInfo!
    const index = prevMask >>> Bits.IndexOffset
    let toggle = false

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    currentMask = prevMask + (1 << Bits.IndexOffset)
    if (prevMask & Bits.IsFirstRun) {
        cells.push(false)
    } else {
        toggle = cells[index] as boolean
        cells[index] = true
    }

    return [toggle, (): Promise<void> => {
        cells[index] = true
        return info.redraw()
    }]
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

type UseValue<S extends UseState, T> =
    S extends UseState.Ready ? T :
        S extends UseState.Error ? ErrorValue :
            undefined

class Use<S extends UseState, T> {
    constructor(private $: S, private _: UseValue<S, T>) {}
    state(): UseStateKeys[S] { return StateLookup[this.$] }
    value(): UseValue<S, T> { return this._ }
    match<R>(matchers: UseMatchers<T, R>): R {
        switch (this.$) {
        case UseState.Pending: return matchers.pending()
        case UseState.Ready: return matchers.ready(this._ as T)
        /* case UseState.Error: */
        default: return matchers.error(this._ as ErrorValue)
        }
    }
}

// `use` is pretty complicated to begin with. Let's not blow this module up
// further by super-optimizing an inherently moderately expensive operation to
// begin with.
export function use<T extends Any>(
    init: (signal: AbortSignal) => T | Promise<T>
): Use<UseState, T>
export function use<T extends Any, D extends Any>(
    dependency: D,
    init: (value: D, signal: AbortSignal) => T | Promise<T>
): Use<UseState, T>
export function use<T extends Any, D extends Any>(
    dependency: D | ((signal: AbortSignal) => T | Promise<T>),
    init?: (value: D, signal: AbortSignal) => T | Promise<T>
): Use<UseState, T> {
    if (init == null) {
        return _use(dependency as (signal: AbortSignal) => T | Promise<T>)
    } else {
        return guard(hasChangedBy(dependency, isEqual), () =>
            _use((signal) => init(dependency as D, signal))
        )
    }
}

function _use<T extends Any>(
    init: (signal: AbortSignal) => T | Promise<T>
): Use<UseState, T> {
    const prevMask = currentMask
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cells = currentCells!
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const info = currentInfo!
    const index = prevMask >>> Bits.IndexOffset

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    currentMask = prevMask + (3 << Bits.IndexOffset)
    if (prevMask & Bits.IsFirstRun) {
        let controller: Maybe<AbortController> =
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            new info.window!.AbortController()
        cells.push(
            UseState.Pending, // state
            void 0, // value
            () => {
                cells[index + 2] = void 0
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const ctrl = controller!
                controller = void 0
                ctrl.abort()
            } // close
        )

        // I'm creating a synthetic promise because it's cheaper than adding
        // `init` to the closure *and* creating a second closure.
        Promise.resolve(controller.signal).then(init).then(
            (v) => {
                cells[index] = UseState.Ready
                cells[index + 1] = v
                info.redraw()
            },
            (e) => {
                cells[index] = UseState.Error
                cells[index + 1] = e
                info.redraw()
            }
        )
    }

    currentMask = prevMask | Bits.HasRemoveCallback
    if (prevMask & Bits.IsNestedRemove) {
        (currentRemoveTarget as WhenRemovedCallback[]).push(
            cells[index + 2] as WhenRemovedCallback
        )
    } else {
        (currentRemoveTarget as Info).whenRemoved(
            cells[index + 2] as WhenRemovedCallback
        )
    }

    return new Use<UseState, T>(
        cells[index] as UseState,
        cells[index + 1] as UseValue<UseState, T>
    )
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
    const prevMask = currentMask
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cells = currentCells!

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    currentMask = prevMask + (arguments.length << Bits.IndexOffset)
    if (prevMask & Bits.IsFirstRun) {
        cells.push.apply(cells, arguments)
        return true
    } else {
        let index = prevMask >>> Bits.IndexOffset
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
    const prevMask = currentMask

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    currentMask = prevMask + (1 << Bits.IndexOffset)
    if (prevMask & Bits.IsFirstRun) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        currentCells!.push(value)
        return true
    } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const cells = currentCells!
        const index = prevMask >>> Bits.IndexOffset
        const prev = cells[index] as T
        cells[index] = value
        return comparator(prev, value)
    }
}

const p = Promise.resolve()

export function defer(func: () => Await<void>): void {
    const prevMask = currentMask

    if (!prevMask) {
        throw new TypeError("This must be called inside a component context.")
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const info = currentInfo!

    p.then(() => func()).catch((e) => {
        info.throw(e as ErrorValue, true)
    })
}
