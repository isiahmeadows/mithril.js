// This contains all the relevant DOM types used throughout. This Intentionally
// does *not* use `lib.dom.d.ts` as I want to be much more selective on what DOM
// dependencies are used.
//
// I also want safer types for integer-valued enums.

// Not part of the DOM, but I want them here for safety anyways. I absolutely do
// *not* want to let these get mixed with other arbitrary strings.
declare const TrustedStringMarker: unique symbol
export type TrustedString = {[TrustedStringMarker]: void}

declare const TagNameStringMarker: unique symbol
export type TagNameString = {[TagNameStringMarker]: void}

// Not technically DOM, but in common use in browser code anyways, and in some
// cases, it means people don't have to add explicit branches in their own code.
export interface EventEmitter<T extends {}> {
    on<K extends keyof T>(name: K, callback: (value: T[K]) => void): void;
    off<K extends keyof T>(name: K, callback: (value: T[K]) => void): void;
}

export interface Window {
    AbortController: {
        prototype: AbortController
        new(): AbortController
    }

    FormData: {
        prototype: FormData
        new(): FormData
    }

    XMLHttpRequest: {
        prototype: XMLHttpRequest
        new(): XMLHttpRequest
    }

    getComputedStyle(elem: Element): CSSStyleDeclarationReadOnly
}

export type EventListenerOrEventListenerObject<
    T extends EventTarget<E>,
    E extends Event<string>
> = EventListener<T, E> | EventListenerObject<E> | null

export type EventListener<T extends EventTarget<E>, E extends Event<string>> =
    (this: T, evt: E) => void

export type EventListenerObject<E extends Event<string>> =
    object & {handleEvent(evt: E): void}

export type EventListenerOptions = object & {
    capture?: boolean
}

export type AddEventListenerOptions = EventListenerOptions & {
    once?: boolean
    passive?: boolean
}

export interface EventTarget<E extends Event<string>> {
    addEventListener<F extends E>(
        type: F["type"],
        listener: EventListenerOrEventListenerObject<this, F> | null,
        options: boolean | AddEventListenerOptions
    ): void
    dispatchEvent(event: E): boolean
    removeEventListener<F extends E>(
        type: F["type"],
        callback: EventListenerOrEventListenerObject<this, F> | null,
        options: boolean | EventListenerOptions
    ): void
}

export interface Event<T extends string> {
    readonly cancelable: boolean
    readonly currentTarget: EventTarget<this> | null
    readonly defaultPrevented: boolean
    readonly eventPhase: EventPhase
    readonly isTrusted: boolean
    readonly target: EventTarget<this> | null
    readonly timeStamp: number
    readonly type: T
    composedPath(): EventTarget<this>[]
    preventDefault(): void
    stopImmediatePropagation(): void
    stopPropagation(): void
}

interface ProgressEvent<T extends string> extends Event<T> {
    readonly lengthComputable: boolean
    readonly loaded: number
    readonly total: number
}

export const enum EventPhase {
    NONE = 0,
    CAPTURING_PHASE = 1,
    AT_TARGET = 2,
    BUBBLING_PHASE = 3,
}

// TODO: expand these
export interface Document {
    defaultView: Window
    createElement(tagName: TagNameString): HTMLElement | SVGElement
}

// These are all the element types we support - it's much easier to work with a
// union than casting every two seconds.
export type Element = HTMLElement | SVGElement | MathMLElement

export interface ElementCommon extends EventTarget<
    | Event<"transitionend">
> {
    ontransitionend: null | EventListener<this, Event<"transitionend">>
    tagName: string
    ownerDocument: Document
    parentElement: Element | null
    style: CSSStyleDeclaration
    offsetHeight: number
    getBoundingClientRect(): DOMRectReadOnly
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HTMLElement extends ElementCommon {
    // TODO
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SVGElement extends ElementCommon {
    // TODO
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MathMLElement extends ElementCommon {
    // TODO
}

export interface CSSStyleDeclarationReadOnly {
    getPropertyPriority(): "" | "important"
    getPropertyValue(property: string): string
}

export interface CSSStyleDeclaration extends CSSStyleDeclarationReadOnly {
    // Note: `style.setProperty(property, "" | null | undefined)` removes the
    // property.
    setProperty(
        property: string,
        value?: APIOptional<string>,
        priority?: "" | "important"
    ): void
}

export interface DOMRectReadOnly {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly top: number
    readonly right: number
    readonly bottom: number
    readonly left: number
}

export interface AbortController {
    readonly signal: AbortSignal
    abort(): void
}

export interface AbortSignal extends EventTarget<Event<"abort">> {
    readonly aborted: boolean
    onabort: null | EventListener<this, Event<"abort">>
}

export type XMLHttpRequestResponseType =
    "" | "arraybuffer" | "blob" | "document" | "json" | "text"

declare const XMLHttpRequestBodyObjectMarker: unique symbol

export interface XMLHttpRequestBodyObject {
    [XMLHttpRequestBodyObjectMarker]: void
}

declare const FormDataMarker: unique symbol
export interface FormData {
    [FormDataMarker]: void
}

export const enum XMLHttpRequestReadyState {
    UNSENT = 0,
    OPENED = 1,
    HEADERS_RECEIVED = 2,
    LOADING = 3,
    DONE = 4,
}

export interface XMLHttpRequest extends EventTarget<
    | Event<"readystatechange">
    | ProgressEvent<"abort">
    | ProgressEvent<"error">
    | ProgressEvent<"load">
    | ProgressEvent<"loadend">
    | ProgressEvent<"loadstart">
    | ProgressEvent<"progress">
    | ProgressEvent<"timeout">
> {
    onreadystatechange: null | EventListener<this, Event<"readystatechange">>
    onabort: null | EventListener<this, ProgressEvent<"abort">>
    onerror: null | EventListener<this, ProgressEvent<"error">>
    onload: null | EventListener<this, ProgressEvent<"load">>
    onloadend: null | EventListener<this, ProgressEvent<"loadend">>
    onloadstart: null | EventListener<this, ProgressEvent<"loadstart">>
    onprogress: null | EventListener<this, ProgressEvent<"progress">>
    ontimeout: null | EventListener<this, ProgressEvent<"timeout">>
    readonly readyState: XMLHttpRequestReadyState
    readonly response: Any
    readonly responseText: string
    responseType: XMLHttpRequestResponseType
    readonly status: number
    readonly statusText: string
    timeout: number
    withCredentials: boolean
    abort(): void
    getAllResponseHeaders(): string
    getResponseHeader(name: string): string | null
    open(method: string, url: string): void
    open(
        method: string, url: string,
        async: boolean,
        username?: string | null | undefined,
        password?: string | null | undefined
    ): void
    overrideMimeType(mime: string): void
    send(
        body?: XMLHttpRequestBodyObject | FormData | string | null | undefined
    ): void
    setRequestHeader(name: string, value: string): void
    readonly DONE: number
    readonly HEADERS_RECEIVED: number
    readonly LOADING: number
    readonly OPENED: number
    readonly UNSENT: number
}
