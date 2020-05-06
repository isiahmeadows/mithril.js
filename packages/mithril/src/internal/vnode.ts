import {Window, TrustedString, TagNameString} from "./dom"

// Note: the types here are *not* publicly exported. They're too loose for
// userland, but also in some cases completely (and intentionally) wrong -
// they're meant to verify the framework itself.

// This bit exists as a type-encoded proof of a few API contracts:
//
// - All values that are not objects with a numeric `%` property, a well as
//   arrays that may recursively contain them, are considered valid vnodes.
// - The `%` property can be literally anything on object vnodes.
type AnyNonSpecialObject =
    | Exclude<Any, object>
    | Array<AnyNonSpecialObject> & {"%"?: Exclude<Any, number>}
    | object & {"%"?: Exclude<Any, number>}
export type __TestVnodeAny = Assert<AnyNonSpecialObject, Vnode>
export type __TestAttributeUnionNonPrimitiveTypeIdentifierIsAny =
    Assert<Any, VnodeAttributes["%"] | VnodeNonPrimitive["%"]>
export type __TestFunctionsAreNotValidVnodes =
    Assert<Is<(...args: Any[]) => Any, Vnode>, false>
export type __TestConstructorsAreNotValidVnodes =
    Assert<Is<new (...args: Any[]) => Any, Vnode>, false>

export const enum Type {
    Retain,
    Element,
    State,
    Link,
    Keyed,
    Static,
    Catch,
    Trust,
    Component,
}

export type __TestTypeEnumIsMinimal = Assert<Type, VnodeNonPrimitive["%"]>
export type __TestTypeEnumIsComplete = Assert<VnodeNonPrimitive["%"], Type>

// The markers here are to ensure these values never get mixed up, despite most
// of them being technically polymorphic over either all objects (attributes,
// events, context) or all values (event values, thrown errors). They are
// intentionally not synthesized. Ideally, I'd use nominal types here, but TS
// doesn't support those.
declare const ErrorValueMarker: unique symbol
declare const EventValueMarker: unique symbol
declare const EventsObjectMarker: unique symbol
declare const RenderTargetMarker: unique symbol
declare const EnvironmentMarker: unique symbol
declare const StateValueMarker: unique symbol
declare const RefValueMarker: unique symbol
declare const LinkValueMarker: unique symbol
declare const KeyValueMarker: unique symbol
declare const AttributesValueMarker: unique symbol
declare const EnvironmentValueMarker: unique symbol
declare const WhenReadyResultMarker: unique symbol
declare const WhenRemovedResultMarker: unique symbol
declare const CatchResultMarker: unique symbol
export type RefValue = {
    [RefValueMarker]: void
}

export type Capture = object & {
    event(): void
    redraw(): void
    eventCaptured(): boolean
}

export type EventValue = {
    [EventValueMarker]: void
}

export type ErrorValue = {
    [ErrorValueMarker]: void
}

export type StateValue = {
    [StateValueMarker]: void
}

export type WhenReadyResult = {
    [WhenReadyResultMarker]: void
}

export type WhenRemovedResult = {
    [WhenRemovedResultMarker]: void
}

export type CatchResult = {
    [CatchResultMarker]: void
}

export type LinkValue = {
    [LinkValueMarker]: void
}

export type KeyValue = PropertyKey & {
    [KeyValueMarker]: void
}

export type EventsObject = object & {
    [EventsObjectMarker]: void
    [key: string]: (this: undefined, e: EventValue, c: Capture) => void
}

export type AttributesValue = {
    [AttributesValueMarker]: void
}

export type VnodeAttributes = object & {
    "%"?: Exclude<Any, number>
    [key: string]: (
        APIOptional<EventsObject | AttributesValue | Exclude<Any, number>>
    )
}

export type VnodeHole = undefined | null | boolean
export type VnodeText = string | number | symbol | bigint
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export type VnodeFragment = Vnode[]

export type EnvironmentValue = {
    [EnvironmentValueMarker]: void
}

export type Environment = object & {
    [EnvironmentMarker]: void
    [key: string]: EnvironmentValue
}

export type RenderTarget = object & {
    [RenderTargetMarker]: void
}

export interface RenderHandle {
    render(...children: Vnode[]): Promise<void>
    close(): Promise<void>
}

export type CloseCallback = () => Promise<void>

export interface ComponentInfo<S> {
    throw(value: ErrorValue, nonFatal: boolean): void
    redraw(): Promise<void>
    render<T>(
        target: RenderTarget,
        init: (info: ComponentInfo<T>) => Vnode
    ): Promise<CloseCallback>
    isParentMoving(): boolean
    isInitial(): boolean
    renderType(): string
    whenReady(callback: WhenReadyCallback): void
    whenRemoved(callback: WhenRemovedCallback): void
    set(key: PropertyKey, value: EnvironmentValue): void
    state: S | undefined
    init(initializer: () => S): S
    ref: RefValue
    window?: Window
}

export type StateInit<
    S, E extends Environment = Environment
> = (info: ComponentInfo<S>, env: E) => Vnode

export type Component<
    A extends VnodeAttributes, S, E extends Environment = Environment
> = (attrs: A, info: ComponentInfo<S>, env: E) => Vnode

export type CatchCallback =
    (error: ErrorValue, nonFatal: boolean) => Await<CatchResult>

export type WhenRemovedCallback =
    () => Await<WhenRemovedResult>

export type WhenReadyCallback =
    (ref: RefValue) => Await<WhenReadyResult>

export type VnodeRetain = object & {
    "%": Type.Retain
    _: void
}

export type VnodeElement = object & {
    "%": Type.Element
    _: [TagNameString, ...Vnode[]]
}

export type VnodeState = object & {
    "%": Type.State
    _: StateInit<StateValue>
}

export type VnodeLink = object & {
    "%": Type.Link
    _: [LinkValue, ...Vnode[]]
}

export type VnodeKeyed = object & {
    "%": Type.Keyed
    // There's no way of specifying alternating keys and values.
    _: Array<KeyValue | Vnode>
}

export type VnodeStatic = object & {
    "%": Type.Static
    _: Vnode
}

export type VnodeCatch = object & {
    "%": Type.Catch
    _: [CatchCallback, ...Vnode[]]
}

export type VnodeTrust = object & {
    "%": Type.Trust
    _: TrustedString
}

export type VnodeComponent = object & {
    "%": Type.Component
    _: [Component<VnodeAttributes, StateValue>, ...Vnode[]]
}

export type Vnode =
    | VnodeHole
    | VnodeAttributes
    | VnodeText
    | VnodeFragment
    | VnodeNonPrimitive

export type VnodeNonPrimitive =
    | VnodeRetain
    | VnodeElement
    | VnodeState
    | VnodeLink
    | VnodeKeyed
    | VnodeStatic
    | VnodeCatch
    | VnodeTrust
    | VnodeComponent

// Strictly for vnodes whose children are arrays
export type NonPrimitiveParentVnode =
    | VnodeElement
    | VnodeLink
    | VnodeCatch
    | VnodeComponent

// The one and only function exported from this
export function create<T extends VnodeNonPrimitive>(
    type: T["%"], value: T["_"]
): T {
    return {"%": type, _: value} as T
}
