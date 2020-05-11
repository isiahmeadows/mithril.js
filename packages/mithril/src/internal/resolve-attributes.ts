// This literally exists to do one thing: resolve an attributes object to
// something much easier for Mithril to understand. This desugars all the
// various special attributes as applicable.
import {
    VnodeAttributes, EventValue, Capture, AttributesValue,
    RefPropertyValue
} from "./vnode"
import {KeyMap, KeySet} from "./key-map"
import {eachKey} from "./util"

export type InternalEventHandler =
    ((event: EventValue, capture: Capture) => Any) |
    [PropertyKey, (value: RefPropertyValue, capture: Capture) => Any]

export interface InternalAttributes {
    a: KeyMap<string, AttributesValue>
    o: KeyMap<string, InternalEventHandler>
    s: KeyMap<string, string>
    c: KeySet<string>
}

function addClass(result: InternalAttributes, className: string) {
    const classes = className.trim().split(/\s*/)
    for (let i = 0; i < classes.length; i++) {
        KeySet.a(result.c, classes[i])
    }
}

export function resolveAttributes(
    result: InternalAttributes,
    attrs: VnodeAttributes
): InternalAttributes {
    eachKey(attrs, (value, key) => {
        if (value == null) return
        if (key === "style") {
            if (typeof value === "string") {
                value.trim().split(/\s*;\s*/).forEach(entry => {
                    const exec = /^([^\s:]+)\s*:\s*(.+)$/.exec(entry)
                    if (exec != null) KeyMap.s(result.s, exec[1], exec[2])
                })
            } else {
                eachKey(value as Record<string, string>, (value, key) => {
                    KeyMap.s(result.s, key, value)
                })
            }
        } else if (key === "class" || key === "className") {
            if (typeof value === "string") {
                addClass(result, value)
            } else {
                eachKey(value, (cond, className) => {
                    if (cond) addClass(result, className)
                })
            }
        } else if (key === "on") {
            eachKey(
                value as Record<string, InternalEventHandler>,
                (listener, eventName) => {
                    KeyMap.s(result.o, eventName, listener)
                }
            )
        } else if (value !== false) {
            // Use HTML's boolean attribute format of `key=""` if true,
            // omitted if false.
            KeyMap.s(result.a, key,
                (value === true ? "" as Any : value) as AttributesValue
            )
        }
    })

    return result as InternalAttributes
}
