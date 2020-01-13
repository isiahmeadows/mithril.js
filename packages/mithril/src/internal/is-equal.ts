let globalTolerance = 0

export interface IsEqualOpts {
    tolerance?: number
}

export function isEqual<T>(a: T, b: T, opts?: IsEqualOpts): boolean
export function isEqual(a: Any, b: Any, opts?: IsEqualOpts) {
    const tolerance = opts?.tolerance ?? 1e-8
    const prevGlobalTolerance = globalTolerance
    globalTolerance = tolerance
    try {
        return checkEqual(a, b)
    } finally {
        globalTolerance = prevGlobalTolerance
    }
}

function checkEqual(a: Any, b: Any): boolean {
    // TODO
    return false
}
