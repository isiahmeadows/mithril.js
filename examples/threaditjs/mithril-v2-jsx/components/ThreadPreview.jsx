import m from "mithril"

export default {
    // eslint-disable-next-line camelcase
    view: ({attrs: {thread: {id, text, comment_count}}}) => <>
        <p>
            <Link>
                <a href={`/thread/${id}`} innerHTML={T.trimTitle(text)} />
            </Link>
        </p>
        {/* eslint-disable-next-line camelcase */}
        <p class="comment_count">{comment_count} comment(s)</p>
        <hr />
    </>,
}
