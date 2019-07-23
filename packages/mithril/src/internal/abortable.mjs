import {create} from "./stream.mjs"

export function abortable(func) {
    return create(function (o) {
        try {
            var aborted = false
            // eslint-disable-next-line no-undef
            var controller = new AbortController()
        } catch (_) {
            controller = {
                abort: function () {
                    if (!aborted) {
                        aborted = true
                        if (typeof controller.signal.onabort === "function") {
                            controller.signal.onabort()
                        }
                    }
                },
                signal: {
                    onabort: null
                }
            }
        }

        try {
            func(controller.signal, o)
            return function () {
                controller.abort()
            }
        } catch (e) {
            controller.abort()
            throw e
        }
    })
}
