const missing = {}

export function join([...keys], ref) {
    let remaining = keys.length
    const values = Object.fromEntries(keys.map(key => [key, missing]))

    return Object.fromEntries(keys.map(key => [key, value => {
        if (values[key] !== missing) return
        values[key] = value
        if (--remaining === 0) {
            const func = ref
            ref = undefined
            func(values)
        }
    }]))
}

export function all(remaining, ref) {
    remaining |= 0
    const values = new Array(remaining).fill(missing)

    return Object.assign(values.map((_, i) => value => {
        if (values[i] !== missing) return
        values[i] = value
        if (--remaining === 0) {
            const func = ref
            ref = undefined
            func(values)
        }
    }), {
        empty: remaining ? undefined : () => {
            const func = ref
            if (func) { ref = undefined; func(values) }
        },
    })
}
