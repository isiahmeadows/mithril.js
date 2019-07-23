// import {makeStringContext, setNamespaceTarget} from "./internal/context.mjs"

// function getChildContext(parent, vnode) {
//     if (parent === "html") {
//         if (vnode.a === "svg") return "svg"
//         else if (vnode.a === "math") return "mathml"
//     } else if (parent === "svg") {
//         if ((/^(foreignObject|desc|title)$/).test(vnode.a)) return "html"
//     } else if (parent === "mathml") {
//         if (
//             vnode.a === "annotation-xml" &&
//             (/^text\/html$|^application\/xhtml+xml$/i).test(vnode.b.encoding)
//         ) return "html"
//     }
//
//     return parent
// }

export function render() {
    // TODO: actually implement this
}
