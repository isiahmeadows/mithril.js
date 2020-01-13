import {m} from "mithril"
import Reply from "./Reply.jsx"

export default function ThreadNode({node}) {
    return (
        <div class="comment">
            <p innerHTML={node.text} />
            <div class="reply"><Reply node={node} /></div>
            <div class="children">
                {m.each(node.children, "id", (child) => (
                    <ThreadNode node={child} />
                ))}
            </div>
        </div>
    )
}
