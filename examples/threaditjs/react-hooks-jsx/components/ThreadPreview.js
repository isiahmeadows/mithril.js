import React from "react"
import {Link} from "react-router"

export default function ThreadPreview({thread}) {
    return <>
        <p>
            <Link
                to={`/thread/${thread.id}`}
                dangerouslySetInnerHTML={{__html: T.trimTitle(thread.text)}}
            />
        </p>
        <p className="comment_count">{thread.comment_count} comment(s)</p>
        <hr />
    </>
}
