import * as V from "./internal/vnode"
import {Window} from "./internal/dom"
// import {makeStringContext, setNamespaceTarget} from "./internal/context.mjs"

interface RenderHTMLOptions {
    xhtml: boolean
}

let env = Object.freeze(Object.create(null) as V.Environment)
let envIsReused = true

const envDesc = {
    configurable: true,
    enumerable: true,
    writable: true,
    value: void 0 as Any
}

/* eslint-disable no-bitwise */
const enum CaptureState { None = 0, Event = 1 << 0, Redraw = 1 << 1 }

class Capture implements V.Capture {
    _ = CaptureState.None
    event(): void { this._ |= CaptureState.Event }
    redraw(): void { this._ |= CaptureState.Redraw }
    eventCaptured() { return !!(this._ & CaptureState.Event) }
    redrawCaptured() { return !!(this._ & CaptureState.Redraw) }
}
/* eslint-enable no-bitwise */

class ComponentInfo<S> implements V.ComponentInfo<S> {
    _closed = true
    state: Maybe<S> = void 0
    ref: Maybe<V.RefValue> = void 0
    window: Maybe<Window> = void 0

    throw(_value: V.ErrorValue, _nonFatal: boolean): void {
        // TODO
    }

    // Return a never-resolving promise. We're not completing redraws.
    redraw() { return new Promise<never>(() => {}) }
    isInitial() { return true }
    renderType() { return "static" }

    // Ignore lifecycle hooks
    whenLayout() {
        if (this._closed) {
            throw new ReferenceError("`whenLayout` called outside render method")
        }
    }

    whenLayoutRemoved() {
        if (this._closed) {
            throw new ReferenceError(
                "`whenLayoutRemoved` called outside render method"
            )
        }
    }

    whenReady() {
        if (this._closed) {
            throw new ReferenceError("`whenReady` called outside render method")
        }
    }

    whenRemoved() {
        if (this._closed) {
            throw new ReferenceError(
                "`whenRemoved` called outside render method"
            )
        }
    }

    setEnv(key: PropertyKey, value: V.EnvironmentValue) {
        if (envIsReused) {
            envIsReused = false
            env = Object.create(env)
        }
        envDesc.value = value
        Object.defineProperty(env, key, envDesc)
        envDesc.value = void 0
    }

    createCapture(): Capture {
        return new Capture()
    }

    init(initializer: () => S): S {
        return this.state = initializer()
    }
}

// function getChildContext(parent, vnode) {
//     if (parent === "html") {
//         if (vnode.a === "svg") return "svg"
//         else if (vnode.a === "math") return "mathml"
//     } else if (parent === "svg") {
//         if ((/^(foreignObject|desc|title)$/).test(vnode.a)) return "html"
//     } else if (parent === "mathml") {
//         if (
//             vnode.a === "annotation-xml" &&
//             (/^text\/html$|^application\/xhtml+xml$/i).test(vnode.b.encoding)
//         ) return "html"
//     }
//
//     return parent
// }

export function renderHTML(vnode: V.Vnode, options: RenderHTMLOptions): string {
    // TODO: actually implement this
    return ""
}
