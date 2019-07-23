import {vnode} from "./internal/util.mjs"
import {assign} from "./internal/util.mjs"

function getTag() {
    // TODO
}

function getAttrs() {
    // TODO
}

function getChildren() {
    // TODO
}

function setAttrs(child, attrs) {
    var newB = {}
    assign(newB, child.b)
    assign(newB, attrs)
    return vnode(child["%type"], child.a, newB)
}

export {
    getTag,
    getAttrs,
    getChildren,
    setAttrs,
}

- Get tag: `getTag(vnode)` - The tag or component, `"#text"` for text nodes, `"#fragment"` for fragments, `"#hole"` for holes, `"#replace"` for replace vnodes, and `"#dynamic"` for dynamic vnodes.
- Get attrs: `getAttrs(vnode)` - The attributes, including the children
- Get children: `getChildren(vnode)` - The children only as an array
- Clone and merge attributes: `setAttrs(vnode, {...attrs})` - A new vnode with the same tag as `vnode` and the attributes of `vnode` merged with `attrs` with `attrs` preferred for conflicts.
