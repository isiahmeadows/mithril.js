[*Up*](README.md)

# DOM root inspection API

This is exposed via `mithril/dom-inspect`.

- `disconnect = inspect(root, onUpdate)` - Observe a root's rendered tree.
    - `disconnect()` - Stop watching the given root.
    - `onUpdate(tree)` is invoked with a serialized tree both initially and on redraw.
    - `onUpdate` is called with `undefined` on dismount.
    - If `root` is not a Mithril root (as in lacks either `._ir` or the `data-mithril-root` attribute), an error is thrown.
    - Note: static hints are explicitly elided from the end tree.
    - Note: only one of these should ever be loaded to the page.

The tree returned is an `IRTree`, where:

```ts
interface IRTree {
    root: ParentNode
    child: IRNode
}

// Shared interfaces
interface IRBase {
    isStatic: boolean
    isRemoved: boolean
}

interface IRParent extends IRBase {
    startRef: ChildNode | null
    nodeCount: number
}

// General interfaces
type IRNode =
    | IRHole
    | IRText
    | IRFragment
    | IRElement
    | IRState
    | IRLink
    | IRKeyed
    | IRComponent
    | IRPortal
    | IRTransition

interface IRHole extends IRBase {
    type: "hole"
}

interface IRText extends IRBase {
    type: "text"
    ref: Text
    data: string
}

interface IRFragment extends IRParent {
    type: "fragment"
    children: IRNode[]
}

interface IRElement extends IRParent {
    type: "element"
    ref: Element
    tagName: string
    attributes: {[key: string]: unknown}
    children: IRNode[]
}

interface IRState extends IRParent {
    type: "state"
    ref: Element
    body: Mithril.StateInit
    state: unknown
    instance: IRNode
}

interface IRLink extends IRParent {
    type: "link"
    identity: unknown
    children: IRNode[]
}

interface IRKeyed extends IRParent {
    type: "keyed"
    entries: [unknown, IRNode]
}

interface Trusted extends IRParent {
    type: "trusted"
    data: string
}

interface IRComponent extends IRParent {
    type: "component"
    tagName: Mithril.Component<any>
    attributes: {[key: string]: unknown}
    children: IRNode[]
    state: IRComponentRawState | IRComponentDSLState;
}

interface IRPortal extends IRParent {
    type: "portal"
    ref: Element
    attributes: {[key: string]: unknown}
    children: IRNode[]
}

interface IRTransition extends IRParent {
    type: "portal"
    options: Mithril.TransitionOptions
    child: IRNode
}

interface IRComponentRawState {
    type: "raw"
    value: any
}

interface IRComponentDSLState {
    type: "dsl"
    cells: IRComponentDSLCell[]
}

type IRComponentDSLCell =
    | IRComponentDSLCellGuard
    | IRComponentDSLCellUseEffect
    | IRComponentDSLCellWhenEmitted
    | IRComponentDSLCellWhen
    | IRComponentDSLCellRef
    | IRComponentDSLCellSlot
    | IRComponentDSLCellUseReducer
    | IRComponentDSLCellLazy
    | IRComponentDSLCellMemo
    | IRComponentDSLCellUsePrevious
    | IRComponentDSLCellUseToggle
    | IRComponentDSLCellUse
    | IRComponentDSLCellHasChanged
    | IRComponentDSLCellHasChangedBy

interface IRComponentDSLCellGuard {
    type: "guard"
    state: IRComponentDSLCell[]
    remainingClosing: number
}

interface IRComponentDSLCellUseEffect {
    type: "useEffect"
    dependency: any
}

interface IRComponentDSLCellWhenEmitted {
    type: "whenEmitted"
    target: EventEmitter | EventTarget
    event: string | symbol
}

interface IRComponentDSLCellWhen {
    type: "when"
    condition: boolean
    state: IRComponentDSLCell[]
    remainingClosing: number
}

interface IRComponentDSLCellRef {
    type: "ref"
    get current(): any
}

interface IRComponentDSLCellSlot {
    type: "ref"
    current: any
}

interface IRComponentDSLCellUseReducer {
    type: "useReducer"
    reducer: Function
    current: any
}

interface IRComponentDSLCellLazy {
    type: "lazy"
    value: any
}

interface IRComponentDSLCellMemo {
    type: "memo"
    value: any
    dependency: any
}

interface IRComponentDSLCellUsePrevious {
    type: "usePrevious"
    current: any
}

interface IRComponentDSLCellUseToggle {
    type: "usePrevious"
    current: boolean
}

interface IRComponentDSLCellUse {
    type: "use"
    current: IRComponentDSLCellUseState
}

type IRComponentDSLCellUseState =
    | IRComponentDSLCellUsePending
    | IRComponentDSLCellUseReady
    | IRComponentDSLCellUseError

interface IRComponentDSLCellUsePending {
    state: "pending"
    value: undefined
}

interface IRComponentDSLCellUseReady {
    state: "ready"
    value: any
}

interface IRComponentDSLCellUseError {
    state: "error"
    value: any
}

interface IRComponentDSLCellHasChanged {
    type: "hasChanged"
    current: any[]
}

interface IRComponentDSLCellHasChangedBy {
    type: "hasChangedBy"
    current: any
}
```

### Why?

1. Developer tooling should be able to inspect this and know what's going on.
1. Developer tooling should not be forced to figure out how to interpret a large array with a very low-level structure on its own.

### Future

Figure out a way to get the [component DSL](component.md) to also be able to be pretty-printed here somehow.
