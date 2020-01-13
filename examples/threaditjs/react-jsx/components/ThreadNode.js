import React from "react"
import Reply from "./Reply.js"

export default function ThreadNode({node}) {
    return (
        <div className="comment">
            <p dangerouslySetInnerHTML={{__html: node.text}} />
            <div className="reply"><Reply node={node} /></div>
            <div className="children">
                {node.children.map((child) => (
                    <ThreadNode key={child.id} node={child} />
                ))}
            </div>
        </div>
    )
}
