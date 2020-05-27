import {
    EventValue, ErrorValue, ComponentInfo, EventListener, EventListenerCallback,
} from "./vnode"

// Supporting function for `whenEmitted` and the native event handlers. It's the
// same logic across both.
export function invokeEvent<
    T extends EventValue,
    R extends AnyNotNull
>(
    info: ComponentInfo<Polymorphic>,
    callback: EventListener<T, R>,
    value: T,
    captured: Maybe<T>,
    ref: R
) {
    try {
        if (typeof callback !== "function") {
            // This is the product of a lot of hacks, to avoid an extra
            // intermediate function
            value = (value as Any as Record<string, T>)[callback[0] as string]
            callback = callback[1] as Any as EventListenerCallback<T, R>
        }

        const capture = info.createCapture(captured)
        const p = callback(value, capture, ref)
        if (p != null && typeof p.then === "function") {
            Promise.resolve(p).then(() => {
                try {
                    if (capture.redrawCaptured()) return
                } catch (e) {
                    info.throw(e as ErrorValue, false)
                    return
                }
                info.redraw()
            }, (e) => {
                info.throw(e as ErrorValue, false)
            })
        } else if (capture.redrawCaptured()) {
            return
        }
    } catch (e) {
        info.throw(e as ErrorValue, false)
        return
    }
    info.redraw()
}

export const isVoidRegexp =
    /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/
