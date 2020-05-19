import {Window, TrustedString, TagNameString} from "./dom"

// Note: the types here are *not* publicly exported. They're too loose for
// userland, but also in some cases completely (and intentionally) wrong -
// they're meant to verify the framework itself.

// This bit exists as a type-encoded proof of a few API contracts:
//
// - All values that are not objects with a numeric `%` property, a well as
//   arrays that may recursively contain them, are considered valid vnodes.
// - The `%` property can be literally anything on object vnodes.
type AnyNonObject = Exclude<Any, object> | Array<AnyNonObject>
export type __TestVnodeAny = Assert<AnyNonObject, Vnode>
export type __TestAttributeValueIsAny = Assert<Any, AttributesObject[string]>
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
    Trust,
    Component,
    Portal,
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
declare const EnvironmentMarker: unique symbol
declare const StateValueMarker: unique symbol
declare const RefPropertyValueMarker: unique symbol
declare const LinkValueMarker: unique symbol
declare const KeyValueMarker: unique symbol
declare const NonSpecialAttributeValueMarker: unique symbol
declare const EnvironmentValueMarker: unique symbol
declare const WhenReadyResultMarker: unique symbol
declare const WhenRemovedResultMarker: unique symbol
declare const CatchResultMarker: unique symbol

export type RefPropertyValue = {
    [RefPropertyValueMarker]: void
}

export type RefValue = APIOptional<Record<PropertyKey, RefPropertyValue>>

export type Capture = object & {
    event(): void
    redraw(): void
    eventCaptured(): boolean
    redrawCaptured(): boolean
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

export type EventListener =
    | ((this: void, e: EventValue, c: Capture) => Await<void>)
    | [PropertyKey, (this: void, e: RefPropertyValue, c: Capture) => Await<void>]

export type EventsObject = object & {
    [EventsObjectMarker]: void
    [key: string]: EventListener
}

export type NonSpecialAttributeValue = {
    [NonSpecialAttributeValueMarker]: void
}

export type AttributesValue = Any | EventsObject | NonSpecialAttributeValue

export type AttributesObject = object & {
    on?: EventsObject
    [key: string]: AttributesValue
}

export type ElementAttributesObject = AttributesObject & {
    class?: Exclude<Any, symbol>
    style?: APIOptional<{[key: string]: Exclude<Any, symbol>}>
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

export interface ComponentInfo<S> {
    throw(value: ErrorValue, nonFatal: boolean): void
    redraw(): Promise<void>
    isParentMoving(): boolean
    isInitial(): boolean
    renderType(): string
    whenReady(callback: WhenReadyCallback): void
    whenRemoved(callback: WhenRemovedCallback): void
    whenCaught(callback: WhenCaughtCallback): void
    setEnv(key: PropertyKey, value: EnvironmentValue): void
    createCapture(event?: Maybe<EventValue>): Capture
    state: S | undefined
    init(initializer: () => S): S
    ref: RefValue
    window?: Window
}

export type StateInit<
    S, E extends Environment = Environment
> = (info: ComponentInfo<S>, env: E) => Vnode

export type Component<
    A extends AttributesObject, S, E extends Environment = Environment
> = (attrs: A, info: ComponentInfo<S>, env: E) => Vnode

export type WhenCaughtCallback =
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
    _: [TagNameString, ElementAttributesObject, ...Vnode[]]
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

export type VnodeTrust = object & {
    "%": Type.Trust
    _: TrustedString
}

export type VnodeComponent = object & {
    "%": Type.Component
    _: [
        Component<AttributesObject, StateValue>,
        APIOptional<AttributesObject>,
        ...Vnode[]
    ]
}

export type VnodePortal = object & {
    "%": Type.Portal
    _: [RefValue | (() => RefValue), APIOptional<AttributesObject>, ...Vnode[]]
}

export type Vnode =
    | VnodeHole
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
    | VnodeTrust
    | VnodeComponent
    | VnodePortal

// Strictly for vnodes whose children are arrays
export type NonPrimitiveParentVnode =
    | VnodeElement
    | VnodeLink
    | VnodeComponent
    | VnodePortal

// The one and only function exported from this
export function create<T extends VnodeNonPrimitive>(
    type: T["%"], value: T["_"]
): T {
    return {"%": type, _: value} as T
}
