import * as V from "./internal/vnode"
import {TagNameString, TrustedString} from "./internal/dom"
import {SENTINEL, assign} from "./internal/util"
import {RETAIN} from "./internal/hyperscript-common"

declare const LegacyStateValueMarker: unique symbol
declare const LegacySpecialAttrsObjectMarker: unique symbol
type LegacyStateValue = {
    [LegacyStateValueMarker]: void
}
type LegacySpecialAttrsObject = {
    [LegacySpecialAttrsObjectMarker]: void
}

const enum SpecialTag {
    Text = "#",
    Fragment = "[",
    Trust = "<",

    // These are purely redesign constructs, and exist for incremental migration
    // of larger legacy components. They have no corresponding legacy construct
    // and can't easily otherwise be factored into the legacy interface.
    Retain = "%r",
    State = "%s",
    Transition = "%t",
    WhenCaught = "%c",
}

interface LegacyComponentVnode<
    A extends LegacyComponentAttrs,
    S extends LegacyComponentInstance<A>
> {
    tag: V.Component<A, LegacyComponentVnode<A, S>>
    key: APIOptional<V.KeyValue>
    attrs: A
    children: APIOptional<LegacyChild[]>
    text: null
    dom: V.RefValue | null
    domSize: number
    state: S | null
}

interface LegacyElementVnode<A extends LegacyElementAttrs> {
    tag: TagNameString | V.RefValue
    key: APIOptional<V.KeyValue>
    attrs: A
    children: APIOptional<LegacyChild[]>
    text: APIOptional<string>
    dom: V.RefValue | null
    domSize: number
    state: LegacyStateValue | null
}

interface LegacySpecialVnode<A extends LegacySpecialAttrs> {
    tag: SpecialTag
    key: APIOptional<V.KeyValue>
    attrs: A
    children: APIOptional<LegacyChild[]>
    text: APIOptional<string>
    dom: null
    domSize: number
    state: Any
}

type LegacyAnyComponentVnode<A extends LegacyComponentAttrs> =
    LegacyComponentVnode<A, LegacyComponentInstance<A>>

type LegacyVnode =
    | LegacyAnyComponentVnode<LegacyComponentAttrs>
    | LegacyElementVnode<LegacyElementAttrs>
    | LegacySpecialVnode<LegacySpecialAttrs>

type LegacyChild = null | LegacyVnode

type LegacyCoercible =
    | Exclude<V.Vnode, object>
    | LegacyChild
    | LegacyCoercible[]

type DynamicTag<A extends LegacyElementAttrs | LegacyComponentAttrs> =
    TagNameString | V.RefValue | (
        A extends LegacyComponentAttrs
            ? V.Component<A, LegacyAnyComponentVnode<A>>
            : never
    )

function makeLegacyVnode(
    tag: SpecialTag.Text,
    key: null,
    attrs: null,
    children: null,
    text: string,
    state: null
): LegacySpecialVnode<never>
function makeLegacyVnode<A extends LegacySpecialAttrs>(
    tag: SpecialTag.Fragment,
    key: APIOptional<V.KeyValue>,
    attrs: A,
    children: LegacyChild[],
    text: null,
    state: null
): LegacySpecialVnode<A>
function makeLegacyVnode(
    tag: SpecialTag.Trust,
    key: null,
    attrs: null,
    children: null,
    text: TrustedString,
    state: null
): LegacySpecialVnode<never>
function makeLegacyVnode(
    tag: SpecialTag.Retain,
    key: null,
    attrs: null,
    children: null,
    text: null,
    state: null
): LegacySpecialVnode<never>
function makeLegacyVnode(
    tag: SpecialTag.State,
    key: null,
    attrs: null,
    children: null,
    text: null,
    state: V.StateInit<V.StateValue>
): LegacySpecialVnode<never>
function makeLegacyVnode(
    tag: SpecialTag.Transition,
    key: null,
    attrs: null,
    children: [LegacyElementVnode<LegacyElementAttrs>],
    text: null,
    state: V.TransitionOptions
): LegacySpecialVnode<never>
function makeLegacyVnode(
    tag: SpecialTag.WhenCaught,
    key: null,
    attrs: null,
    children: [LegacyChild],
    text: null,
    state: V.WhenCaughtCallback
): LegacySpecialVnode<never>
function makeLegacyVnode<A extends LegacyElementAttrs | LegacyComponentAttrs>(
    tag: DynamicTag<A>,
    key: null,
    attrs: A,
    children: LegacyChild[],
    text: null,
    state: LegacyStateValue | null
): (
    A extends LegacyComponentAttrs
        ? LegacyAnyComponentVnode<A>
        : A extends LegacyElementAttrs ? LegacyElementVnode<A> :
            never
)
function makeLegacyVnode<
    A extends LegacyComponentAttrs,
    S extends LegacyComponentInstance<A>
>(
    tag: V.Component<A, LegacyComponentVnode<A, S>>,
    key: null,
    attrs: A,
    children: LegacyChild[],
    text: null,
    state: S | null
): LegacyComponentVnode<A, S>
function makeLegacyVnode(
    // TS won't shut up about the element overload not being compatible with the
    // implementation. Easiest to just shut it up as I can't figure out what's
    // causing it to be that way, and even typing as much as one of these is
    // enough for it to complain.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    tag: any,
    key: any,
    attrs: any,
    children: any,
    text: any,
    state: any
    /* eslint-enable @typescript-eslint/no-explicit-any */
) {
    return {tag, key, attrs, children, text, dom: null, domSize: 0, state}
}

const LEGACY_RETAIN = /*@__PURE__*/ makeLegacyVnode(
    SpecialTag.Retain,
    null,
    null,
    null,
    null,
    null
)

interface LegacyComponentInstance<
    A extends LegacyComponentAttrs
> extends LegacyStateValue {
    readonly oninit?: (
        (this: this, vnode: LegacyComponentVnode<A, this>) => Any
    )
    readonly oncreate?: (
        (this: this, vnode: LegacyComponentVnode<A, this>) => Any
    )
    readonly onbeforeupdate?: (
        (
            this: this,
            vnode: LegacyComponentVnode<A, this>,
            prev: LegacyComponentVnode<A, this>
        ) => Any
    )
    readonly onupdate?: (
        (this: this, vnode: LegacyComponentVnode<A, this>) => Any
    )
    readonly onbeforeremove?: (
        (this: this, vnode: LegacyComponentVnode<A, this>) => Await<Any>
    )
    readonly onremove?: (
        (this: this, vnode: LegacyComponentVnode<A, this>) => Any
    )
    readonly view: (
        (this: this, vnode: LegacyComponentVnode<A, this>) => LegacyCoercible
    )
}

interface LegacyComponentAttrs extends V.ComponentAttributesObject {
    readonly oninit?: V.OtherComponentAttributeValue & (
        (
            this: this,
            vnode: LegacyAnyComponentVnode<this>
        ) => Any
    )
    readonly oncreate?: V.OtherComponentAttributeValue & (
        (
            this: this,
            vnode: LegacyAnyComponentVnode<this>
        ) => Any
    )
    readonly onbeforeupdate?: V.OtherComponentAttributeValue & (
        (
            this: this,
            vnode: LegacyAnyComponentVnode<this>,
            prev: LegacyAnyComponentVnode<this>
        ) => Any
    )
    readonly onupdate?: V.OtherComponentAttributeValue & (
        (
            this: this,
            vnode: LegacyAnyComponentVnode<this>
        ) => Any
    )
    readonly onbeforeremove?: V.OtherComponentAttributeValue & (
        (
            this: this,
            vnode: LegacyAnyComponentVnode<this>
        ) => Await<Any>
    )
    readonly onremove?: V.OtherComponentAttributeValue & (
        (
            this: this,
            vnode: LegacyAnyComponentVnode<this>
        ) => Any
    )
    readonly key?: APIOptional<V.KeyValue>
}

interface LegacyElementAttrs extends V.ElementAttributesObject {
    readonly oninit?: V.OtherElementAttributeValue & (
        (this: this, vnode: LegacyElementVnode<this>) => Any
    )
    readonly oncreate?: V.OtherElementAttributeValue & (
        (this: this, vnode: LegacyElementVnode<this>) => Any
    )
    readonly onbeforeupdate?: V.OtherElementAttributeValue & (
        (
            this: this,
            vnode: LegacyElementVnode<this>,
            prev: LegacyElementVnode<this>
        ) => Any
    )
    readonly onupdate?: V.OtherElementAttributeValue & (
        (this: this, vnode: LegacyElementVnode<this>) => Any
    )
    readonly onbeforeremove?: V.OtherElementAttributeValue & (
        (this: this, vnode: LegacyElementVnode<this>) => Await<Any>
    )
    readonly onremove?: V.OtherElementAttributeValue & (
        (this: this, vnode: LegacyElementVnode<this>) => Any
    )
    readonly key?: APIOptional<V.KeyValue>
}

interface LegacySpecialAttrs extends LegacySpecialAttrsObject {
    readonly oninit?: V.OtherElementAttributeValue & (
        (this: this, vnode: LegacySpecialVnode<this>) => Any
    )
    readonly oncreate?: V.OtherElementAttributeValue & (
        (this: this, vnode: LegacySpecialVnode<this>) => Any
    )
    readonly onbeforeupdate?: V.OtherElementAttributeValue & (
        (
            this: this,
            vnode: LegacySpecialVnode<this>,
            prev: LegacySpecialVnode<this>
        ) => Any
    )
    readonly onupdate?: V.OtherElementAttributeValue & (
        (this: this, vnode: LegacySpecialVnode<this>) => Any
    )
    readonly onbeforeremove?: V.OtherElementAttributeValue & (
        (this: this, vnode: LegacySpecialVnode<this>) => Await<Any>
    )
    readonly onremove?: V.OtherElementAttributeValue & (
        (this: this, vnode: LegacySpecialVnode<this>) => Any
    )
    readonly key?: APIOptional<V.KeyValue>
}

interface LegacyClosureComponent<
    A extends LegacyComponentAttrs,
    S extends LegacyComponentInstance<A>
> {
    (vnode: LegacyComponentVnode<A, never>): S
    readonly prototype?: APIOptional<{
        readonly view?: APIOptional<never>
    }>
}

interface LegacyClassComponent<
    A extends LegacyComponentAttrs,
    S extends LegacyComponentInstance<A>
> {
    new (vnode: LegacyComponentVnode<A, never>): S
    readonly prototype: LegacyComponentInstance<A>
}

type LegacyComponent<
    A extends LegacyComponentAttrs,
    S extends LegacyComponentInstance<A>
> =
    | S
    | LegacyClosureComponent<A, S>
    | LegacyClassComponent<A, S>

// Let's avoid a ton of casts by working with the intersection of all of them.
type AnyLegacyVnode =
    & LegacyAnyComponentVnode<LegacyComponentAttrs>
    & LegacyElementVnode<LegacyElementAttrs>
    & LegacySpecialVnode<LegacySpecialAttrs>

type AnyLegacyAttrs = AnyLegacyVnode["attrs"]

function makeStateTracker<C extends LegacyVnode>(
    child: C,
    migrated: V.Vnode
): V.VnodeState {
    return V.create(V.Type.State, (i) => {
        const prev = i.state as unknown as Maybe<AnyLegacyVnode>
        const next = child as AnyLegacyVnode
        i.state = child as unknown as V.StateValue

        if (prev == null) {
            // Lie, but for component vnodes, people shouldn't be relying on
            // access to internal state anyways.
            next.state = {} as LegacyComponentInstance<LegacyComponentAttrs>
        } else {
            next.state = prev.state
            next.dom = prev.dom
            next.domSize = prev.domSize
        }

        if (next.attrs == null) return migrated

        let hook: Maybe<(this: AnyLegacyAttrs, vnode: AnyLegacyVnode) => Any>

        if (prev == null) {
            if (typeof next.attrs.oninit === "function") {
                next.attrs.oninit(next)
            }
            if (typeof next.attrs.oncreate === "function") {
                hook = next.attrs.oncreate
            }
        } else {
            if (typeof next.attrs.onbeforeupdate === "function") {
                const shouldUpdate = next.attrs.onbeforeupdate(next, prev)

                if (shouldUpdate != null && !shouldUpdate) return RETAIN
            }
            if (typeof next.attrs.onupdate === "function") {
                hook = next.attrs.onupdate
            }
        }

        invokeFinalHooks(i, next, next.attrs, hook)
        return migrated
    })
}

function invokeFinalHooks<
    C extends LegacyVnode,
    S extends (
        LegacyElementAttrs | LegacyComponentAttrs | LegacySpecialAttrs |
        LegacyComponentInstance<LegacyComponentAttrs>
    )
>(
    info: V.ComponentInfo<Polymorphic>,
    legacyVnode: C,
    source: S,
    hook: Maybe<(this: S, vnode: C) => Any>
) {
    if (hook != null) {
        info.whenLayout(() => {
            hook.call(source, legacyVnode)
            return void 0 as unknown as V.WhenLayoutResult
        })
    }

    let onbeforeremove: Maybe<(this: S, vnode: C) => Await<Any>>
    let onremove: Maybe<(this: S, vnode: C) => Any>
    if (typeof source.onbeforeremove === "function") {
        onbeforeremove = source.onbeforeremove as (
            (this: S, vnode: C) => Await<Any>
        )
    }
    if (typeof source.onremove === "function") {
        onremove = source.onremove as (this: S, vnode: C) => Any
    }

    if (onbeforeremove == null) {
        if (onremove != null) {
            info.whenLayoutRemoved(() => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                onremove!.call(source, legacyVnode)
                return void 0 as unknown as V.WhenLayoutRemovedResult
            })
        }
    } else if (onremove == null) {
        info.whenLayoutRemoved(() =>
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            onbeforeremove!.call(source, legacyVnode) as unknown as (
                Await<V.WhenLayoutRemovedResult>
            )
        )
    } else {
        info.whenLayoutRemoved(() => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const result = onbeforeremove!.call(source, legacyVnode)
            if (
                result != null &&
                typeof (result as PromiseLike<Polymorphic>).then === "function"
            ) {
                return Promise.resolve(result).then(
                    () => {
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        onremove!.call(source, legacyVnode)
                        return void 0 as unknown as (
                            V.WhenLayoutRemovedResult
                        )
                    }
                )
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            onremove!.call(source, legacyVnode)
            return void 0 as unknown as (
                V.WhenLayoutRemovedResult
            )
        })
    }

    if (onbeforeremove != null || onremove != null) {
        info.whenLayoutRemoved(() => {
            if (onbeforeremove != null) {
                const result = onbeforeremove.call(source, legacyVnode)
                if (
                    result != null &&
                    typeof (
                        result as PromiseLike<Polymorphic>
                    ).then === "function"
                ) {
                    return Promise.resolve(result).then(
                        () => {
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            onremove!.call(source, legacyVnode)
                            return void 0 as unknown as (
                                V.WhenLayoutRemovedResult
                            )
                        }
                    )
                }
            }
            return void 0 as unknown as V.WhenLayoutRemovedResult
        })
    }
}

function migrateMaybeKeyed(child: LegacyCoercible[]): V.Vnode {
    if (
        child.length &&
        child[0] != null && (child[0] as LegacyVnode).key != null
    ) {
        const result: Array<V.KeyValue | V.Vnode> = []
        for (let i = 0; i < child.length; i++) {
            result.push((child[i] as LegacyVnode).key)
            result.push(migrateOldTree(child[i]))
        }
        return V.create(V.Type.Keyed, result)
    } else {
        return child.map(migrateOldTree)
    }
}

export function migrateOldTree(child: LegacyCoercible): V.Vnode {
    if (child == null || typeof child !== "object") return child
    if (Array.isArray(child)) return migrateMaybeKeyed(child)
    if (child.tag == null) throw new TypeError("Invalid vnode object.")

    type Items = (
        | V.VnodeElement
        | V.VnodeComponent
        | V.VnodePortal
        | V.VnodeWhenCaught
        | V.VnodeTransition
    )["_"]
    let tag: Items[0]
    let type: V.Type

    switch (child.tag) {
    case SpecialTag.Retain:
        return RETAIN

    case SpecialTag.Text:
        return child.text

    case SpecialTag.Fragment:
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return makeStateTracker(child, migrateMaybeKeyed(child.children!))

    case SpecialTag.State:
        return V.create(V.Type.State, child.state as V.StateInit<V.StateValue>)

    case SpecialTag.Trust:
        return V.create(V.Type.Trust, child.text as unknown as TrustedString)

    case SpecialTag.Transition:
        type = V.Type.WhenCaught
        break

    case SpecialTag.WhenCaught:
        type = V.Type.WhenCaught
        break

    default:
        tag = child.tag as Items[0]
        if (typeof tag === "string") {
            type = V.Type.Element
        } else if (typeof tag === "function") {
            // Components have a special path.
            return V.create(V.Type.Component, [
                tag,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                child.children!.length
                    ? assign(
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        {children: child.children!.map(migrateOldTree)},
                        child.attrs as V.ComponentAttributesObject
                    )
                    : child.attrs as V.ComponentAttributesObject
            ])
        } else if (typeof tag === "object") {
            type = V.Type.Portal
        } else {
            throw new TypeError("Invalid vnode object.")
        }
    }

    // Just use an empty state tracker for tracking lifecycle properties.
    const stateTracker = makeStateTracker(child, null)

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let result = migrateMaybeKeyed(child.children!) as (
        Array<Items[number]> | V.VnodeKeyed
    )

    if (Array.isArray(result)) {
        result.unshift(tag, child.state as Items[1])
        result.push(stateTracker)
    } else {
        result = [tag, child.state as Items[1], result, stateTracker]
    }

    return V.create(type, result as Items)
}

function migrateSegmentInPlace(children: Array<V.Vnode | LegacyChild>): void {
    for (let i = 0; i < children.length; i++) {
        children[i] = migrateNewTree(children[i] as V.Vnode)
    }
}

export function migrateNewTree(child: V.Vnode): LegacyChild {
    if (child == null || typeof child === "boolean") return null
    if (typeof child !== "object") {
        return makeLegacyVnode(
            SpecialTag.Text,
            null,
            null,
            null,
            String(child),
            null
        )
    }

    if (Array.isArray(child)) {
        return makeLegacyVnode(
            SpecialTag.Fragment,
            null,
            {} as LegacySpecialAttrs,
            child.map(migrateNewTree),
            null,
            null
        )
    }

    switch (child[""]) {
    case V.Type.Retain:
        return LEGACY_RETAIN

    case V.Type.Element:
    case V.Type.Portal: {
        const children = child._.slice(2) as Array<V.Vnode | LegacyChild>
        migrateSegmentInPlace(children)
        return makeLegacyVnode(
            child._[0] as DynamicTag<LegacyComponentAttrs | LegacyElementAttrs>,
            null,
            child._[1] as LegacyComponentAttrs | LegacyElementAttrs,
            children as LegacyChild[],
            null,
            null
        )
    }

    case V.Type.Component: {
        const attrs = child._[1]
        return makeLegacyVnode(
            child._[0] as unknown as (
                LegacyAnyComponentVnode<LegacyComponentAttrs>["tag"]
            ),
            null,
            attrs as LegacyComponentAttrs,
            (attrs.children as V.Vnode[]).map(migrateNewTree),
            null,
            null
        )
    }

    case V.Type.State:
        return makeLegacyVnode(
            SpecialTag.State,
            null,
            null,
            null,
            null,
            child._
        )

    case V.Type.Link: {
        const children = child._.slice(2) as Array<V.Vnode | LegacyChild>
        migrateSegmentInPlace(children)
        return makeLegacyVnode(
            SpecialTag.Fragment,
            null,
            {} as LegacySpecialAttrs,
            [
                makeLegacyVnode(
                    SpecialTag.Fragment,
                    child._[0] as unknown as V.KeyValue,
                    {} as LegacySpecialAttrs,
                    children as LegacyChild[],
                    null,
                    null
                )
            ],
            null,
            null
        )
    }

    case V.Type.Keyed: {
        const children: LegacyChild[] = []
        for (let i = 0; i < child._.length; i += 2) {
            children.push(makeLegacyVnode(
                SpecialTag.Fragment,
                child._[i] as unknown as V.KeyValue,
                {} as LegacySpecialAttrs,
                [migrateNewTree(child._[i + 1])],
                null,
                null
            ))
        }
        return makeLegacyVnode(
            SpecialTag.Fragment,
            null,
            {} as LegacySpecialAttrs,
            children,
            null,
            null
        )
    }

    case V.Type.Trust:
        return makeLegacyVnode(
            SpecialTag.Trust,
            null,
            null,
            null,
            child._,
            null
        )

    case V.Type.Transition:
        return makeLegacyVnode(
            SpecialTag.Transition,
            null,
            null,
            [migrateNewTree(child._[2]) as (
                LegacyElementVnode<LegacyElementAttrs>
            )],
            null,
            child._[1]
        )

    case V.Type.WhenCaught:
        return makeLegacyVnode(
            SpecialTag.WhenCaught,
            null,
            null,
            [migrateNewTree(child._[2])],
            null,
            child._[1]
        )
    }
}

// This throws `SENTINEL` whenever it finds something it can't migrate, so it's
// possible to skip migration of invalid trees when implicitly creating the
// `children` for `migrateComponent`. Much easier than doing a *lot* of explicit
// checks and optional propagation.
function tryMigrateNewTree(child: Any): LegacyChild {
    if (child == null || typeof child === "boolean") return null
    if (typeof child !== "object") {
        return makeLegacyVnode(
            SpecialTag.Text,
            null,
            null,
            null,
            String(child),
            null
        )
    }

    if (Array.isArray(child)) {
        return makeLegacyVnode(
            SpecialTag.Fragment,
            null,
            {} as LegacySpecialAttrs,
            child.map(migrateNewTree),
            null,
            null
        )
    }

    switch ((child as {""?: Any})[""]) {
    case V.Type.Retain:
        return LEGACY_RETAIN

    case V.Type.Element:
    case V.Type.Component:
    case V.Type.Portal: {
        const children = (
            child as V.VnodeElement | V.VnodeComponent | V.VnodePortal
        )._.slice(2) as Array<V.Vnode | LegacyChild>
        migrateSegmentInPlace(children)
        return makeLegacyVnode(
            (
                child as V.VnodeElement | V.VnodeComponent | V.VnodePortal
            )._[0] as DynamicTag<LegacyComponentAttrs | LegacyElementAttrs>,
            null,
            (
                child as V.VnodeElement | V.VnodeComponent | V.VnodePortal
            )._[1] as LegacyComponentAttrs | LegacyElementAttrs,
            children as LegacyChild[],
            null,
            null
        )
    }

    case V.Type.State:
        return makeLegacyVnode(
            SpecialTag.State,
            null,
            null,
            null,
            null,
            (child as V.VnodeState)._
        )

    case V.Type.Link: {
        const children = (child as V.VnodeLink)._.slice(2) as (
            Array<V.Vnode | LegacyChild>
        )
        migrateSegmentInPlace(children)
        return makeLegacyVnode(
            SpecialTag.Fragment,
            null,
            {} as LegacySpecialAttrs,
            [
                makeLegacyVnode(
                    SpecialTag.Fragment,
                    (child as V.VnodeLink)._[0] as unknown as V.KeyValue,
                    {} as LegacySpecialAttrs,
                    children as LegacyChild[],
                    null,
                    null
                )
            ],
            null,
            null
        )
    }

    case V.Type.Keyed: {
        const children: LegacyChild[] = []
        for (let i = 0; i < (child as V.VnodeKeyed)._.length; i += 2) {
            children.push(makeLegacyVnode(
                SpecialTag.Fragment,
                (child as V.VnodeKeyed)._[i] as unknown as V.KeyValue,
                {} as LegacySpecialAttrs,
                [migrateNewTree((child as V.VnodeKeyed)._[i + 1])],
                null,
                null
            ))
        }
        return makeLegacyVnode(
            SpecialTag.Fragment,
            null,
            {} as LegacySpecialAttrs,
            children,
            null,
            null
        )
    }

    case V.Type.Trust:
        return makeLegacyVnode(
            SpecialTag.Trust,
            null,
            null,
            null,
            (child as V.VnodeTrust)._,
            null
        )

    case V.Type.Transition:
        return makeLegacyVnode(
            SpecialTag.Transition,
            null,
            null,
            [migrateNewTree((child as V.VnodeTransition)._[2]) as (
                LegacyElementVnode<LegacyElementAttrs>
            )],
            null,
            (child as V.VnodeTransition)._[1]
        )

    case V.Type.WhenCaught:
        return makeLegacyVnode(
            SpecialTag.WhenCaught,
            null,
            null,
            [migrateNewTree((child as V.VnodeWhenCaught)._[2])],
            null,
            (child as V.VnodeWhenCaught)._[1]
        )

    default:
        throw SENTINEL
    }
}

type Migrated<
    A extends LegacyComponentAttrs,
    S extends LegacyComponentInstance<A>
> = V.Component<A, LegacyComponentVnode<A, S>>

type AnyLegacyComponent = LegacyComponent<
    LegacyComponentAttrs,
    LegacyComponentInstance<LegacyComponentAttrs>
>
type AnyNewComponent = Migrated<
    LegacyComponentAttrs,
    LegacyComponentInstance<LegacyComponentAttrs>
>

const cache: Maybe<WeakMap<AnyLegacyComponent, AnyNewComponent>> =
    typeof WeakMap === "function" ? new WeakMap() : void 0

export function migrateComponent<
    A extends LegacyComponentAttrs,
    S extends LegacyComponentInstance<A>
>(
    LegacyComp: LegacyComponent<A, S>
): Migrated<A, S> {
    if (cache != null) {
        const prev = cache.get(LegacyComp as unknown as AnyLegacyComponent)
        if (prev != null) return prev as unknown as Migrated<A, S>
    }

    const enum ComponentType {
        Object,
        Closure,
        Class
    }

    const componentType: ComponentType =
        typeof LegacyComp !== "function"
            ? ComponentType.Object
            : (
                LegacyComp.prototype != null &&
                typeof LegacyComp.prototype.view === "function"
            )
                ? ComponentType.Class
                : ComponentType.Closure

    // TODO
    const NewComp: Migrated<A, S> = (attrs, info) => {
        let children: LegacyChild[] = []
        try {
            const result = tryMigrateNewTree(attrs.children)
            if (result != null) {
                children = Array.isArray(result) ? result : [result]
            }
        } catch (e) {
            if (SENTINEL !== e) throw e
        }

        const prevLegacyVnode = info.state
        let state: S
        const legacyVnode = info.state = makeLegacyVnode<A, S>(
            NewComp,
            null,
            attrs,
            children,
            null,
            null
        )

        let hook: Maybe<(this: S, vnode: LegacyComponentVnode<A, S>) => Any>

        if (prevLegacyVnode == null) {
            if (componentType === ComponentType.Object) {
                state = legacyVnode.state = Object.create(LegacyComp)
            } else if (componentType === ComponentType.Closure) {
                state = legacyVnode.state = (
                    LegacyComp as LegacyClosureComponent<A, S>
                )(legacyVnode as unknown as LegacyComponentVnode<A, never>)
            } else /* if (componentType === ComponentType.Class) */ {
                state = legacyVnode.state = new (
                    LegacyComp as LegacyClassComponent<A, S>
                )(legacyVnode as unknown as LegacyComponentVnode<A, never>)
            }

            if (typeof state.oninit === "function") state.oninit(legacyVnode)
            if (typeof state.oncreate === "function") hook = state.oncreate
        } else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            state = legacyVnode.state = prevLegacyVnode.state!
            if (typeof state.onbeforeupdate === "function") {
                const shouldUpdate =
                    state.onbeforeupdate(legacyVnode, prevLegacyVnode)

                if (shouldUpdate != null && !shouldUpdate) {
                    return RETAIN
                }
            }
            if (typeof state.onupdate === "function") hook = state.onupdate
        }

        const view = migrateOldTree(state.view(legacyVnode))

        if (
            view != null && typeof view === "object" && !Array.isArray(view) &&
            view[""] === V.Type.Element
        ) {
            return V.create(V.Type.Element,
                view._.concat(
                    V.create(V.Type.State, (i) => {
                        i.whenLayout((dom) => {
                            legacyVnode.dom = dom
                            legacyVnode.domSize = 1
                            if (hook != null) {
                                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                hook.call(legacyVnode.state!, legacyVnode)
                            }
                            return void 0 as unknown as V.WhenLayoutResult
                        })
                        return null
                    })
                ) as V.VnodeElement["_"]
            )
        }

        // Lots of type casting as the recursive type I'd need isn't possible to
        // construct generically in TS.
        invokeFinalHooks(
            info,
            legacyVnode as unknown as (
                LegacyAnyComponentVnode<LegacyComponentAttrs>
            ),
            state as unknown as LegacyComponentInstance<LegacyComponentAttrs>,
            hook as Maybe<(
                this: LegacyComponentInstance<LegacyComponentAttrs>,
                vnode: LegacyAnyComponentVnode<LegacyComponentAttrs>
            ) => Any>
        )

        return view
    }

    if (cache != null) {
        cache.set(
            LegacyComp as unknown as AnyLegacyComponent,
            NewComp as unknown as AnyNewComponent
        )
    }

    return NewComp
}

// TODO: bring old hyperscript API here.
