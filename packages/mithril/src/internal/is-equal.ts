let globalTolerance = 0
let stackA: Polymorphic[]
let stackB: Polymorphic[]

export interface IsEqualOpts {
    tolerance?: number
}

export function isEqual<T extends Any>(a: T, b: T, opts?: IsEqualOpts): boolean
export function isEqual(a: Any, b: Any, opts?: IsEqualOpts) {
    const tolerance = +(opts?.tolerance ?? 1e-8)
    const prevGlobalTolerance = globalTolerance
    const prevStackA = stackA
    const prevStackB = stackB
    globalTolerance = tolerance
    stackA = []
    stackB = []
    try {
        return checkEqual(a, b)
    } finally {
        globalTolerance = prevGlobalTolerance
        stackA = prevStackA
        stackB = prevStackB
    }
}

function checkEqual(a: Any, b: Any): boolean {
    // TODO
    return false
}
