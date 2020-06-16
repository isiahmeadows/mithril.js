import {
    ComponentInfo, WhenRemovedResult, WhenRemovedCallback,
} from "./vnode"

export const enum CellType {
    Guard,
    UseEffect,
    WhenEmitted,
    When,
    Ref,
    Slot,
    UseReducer,
    Lazy,
    Memo,
    UsePrevious,
    UseToggle,
    Use,
    HasChanged,
    HasChangedBy,
}

export const CellTypeTable = [
    "guard",
    "useEffect",
    "whenEmitted",
    "when",
    "ref",
    "slot",
    "useReducer",
    "lazy",
    "memo",
    "usePrevious",
    "useToggle",
    "use",
    "hasChanged",
    "hasChangedBy",
] as const

export type CellList = Any[]
export type Info = ComponentInfo<CellList>
export type RemoveCallback = () => Await<WhenRemovedResult>
export type RemoveChild = WhenRemovedCallback<Info>
