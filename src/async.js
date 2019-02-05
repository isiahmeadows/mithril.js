"use strict"

// 0 = pending
// 1 = ready
// 2 = error
function Async(attrs, context) {
    var state = 0, value

    try {
        Promise.resolve(attrs.init()).then(
            function (v) { state = 1; value = v; context.update() },
            function (e) { state = 2; value = e; context.update() },
        )
    } catch (e) {
        state = 2
        value = e
    }

    return function (attrs) {
        if (state === 0) return attrs.pending()
        if (state === 1) return attrs.ready(value)
        return attrs.error(value)
    }
}

module.exports = Async
