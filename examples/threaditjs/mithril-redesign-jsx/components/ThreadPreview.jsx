import {m, linkTo} from "mithril"

export default function ThreadPreview({thread}) {
    const title = T.trimTitle(thread.text)
    return <>
        <p><a innerHTML={title}>{linkTo(`/thread/${thread.id}`)}</a></p>
        {/* eslint-disable-next-line camelcase */}
        <p class="comment_count">{thread.comment_count} comment(s)</p>
        <hr />
    </>
}
