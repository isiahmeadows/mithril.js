import {Element} from "./dom"

export const enum DefaultLeeway { Value = 300 }

// eslint-disable-next-line no-bitwise
export const enum Axis { X = 1 << 0, Y = 1 << 1, XY = X | Y }

export function isElemInViewport(
    elem: Element, axis: Axis,
    leeway: number = DefaultLeeway.Value
): boolean {
    leeway = Math.abs(leeway)
    const rect = elem.getBoundingClientRect()
    const docElem = elem.ownerDocument
    const win = docElem.defaultView

    // eslint-disable-next-line no-bitwise
    if (axis & Axis.X && (
        (rect.right + leeway) < 0 ||
        (rect.left + leeway) > Math.max(docElem.clientWidth, win.innerWidth)
    )) return false
    // eslint-disable-next-line no-bitwise
    if (axis & Axis.Y && (
        (rect.bottom + leeway) < 0 ||
        (rect.top + leeway) > Math.max(docElem.clientHeight, win.innerHeight)
    )) return false
    return true
}
