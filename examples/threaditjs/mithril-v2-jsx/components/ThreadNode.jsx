import m from "mithril"
import Reply from "./Reply.jsx"

export default {
    view: ({tag: ThreadNode, attrs: {node}}) => (
        <div class="comment">
            <p>{m.trust(node.text)}</p>,
            <div class="reply"><Reply node={node} /></div>
            <div class="children">{node.children.map(
                (child) => <ThreadNode key={child.id} node={child} />
            )}</div>
        </div>
    ),
}
