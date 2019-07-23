export var assign = /*@__PURE__*/ (Object.assign || function (target, source) {
    for (var key in source) {
        if (hasOwn.call(source, key)) target[key] = source[key]
    }
    return target
})

export var hasOwn = /*@__PURE__*/ {}.hasOwnProperty

export var sentinel = {}

export function forEach(value, func) {
    for (var key in value) {
        if (hasOwn.call(value, key)) {
            func(value[key], key)
        }
    }
}

export function arrayOrRest() {
    if (Array.isArray(arguments[this])) return arguments[this].slice()
    var list = []
    for (var i = this; i < arguments.length; i++) list.push(arguments[i])
    return list
}

export function arrayOrRestCompact() {
    var result = []
    var list
    if (Array.isArray(arguments[this])) {
        list = arguments[this].slice()
        for (var i = 0; i < list.length; i++) {
            if (list[i] != null) result.push(list[i])
        }
    } else {
        for (var i = this; i < arguments.length; i++) {
            if (arguments[i] != null) result.push(arguments[i])
        }
    }
    return list
}
