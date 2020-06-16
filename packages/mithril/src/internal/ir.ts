import {Type as VnodeType, TypeMask as VnodeTypeMask} from "./vnode"

/* eslint-disable no-bitwise */
// Note: this must align with the public API for the intersection.
export const enum Type {
    Fragment = VnodeType.Retain,
    // BEGIN REIFIED API
    Element = VnodeType.Element,
    State = VnodeType.State,
    Link = VnodeType.Link,
    Keyed = VnodeType.Keyed,
    Trust = VnodeType.Trust,
    Component = VnodeType.Component,
    Portal = VnodeType.Portal,
    Transition = VnodeType.Transition,
    WhenCaught = VnodeType.WhenCaught,
    // END REIFIED API
    Text,
}

export const enum TypeMask {
    // Note: This is checked via `type > TypeMask.LastConcrete`.
    LastConcrete = Type.Text,

    IsStatic = VnodeTypeMask.IsStatic,
    IsRemoved = 1 << 7,

    ChildCountOffset = 8,

    // Note: This is checked via `TypeMask.IsParent >> type & 1`.
    IsParent = (
        1 << Type.Element |
        1 << Type.Link |
        1 << Type.Component |
        1 << Type.Portal |
        1 << Type.Transition |
        1 << Type.WhenCaught
    ),

    // Note: This is checked via `TypeMask.HasRef >> type & 1`.
    HasRef = (
        1 << Type.Element |
        1 << Type.Text |
        1 << Type.Portal
    ),
}
/* eslint-enable no-bitwise */
