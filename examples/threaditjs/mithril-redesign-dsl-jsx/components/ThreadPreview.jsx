import {m, component, useEnv} from "mithril"

export const ThreadPreview = component(({thread}) => {
    const title = T.trimTitle(thread.text)
    return <>
        <p><a innerHTML={title}>{useEnv().router.linkTo(`/thread/${thread.id}`)}</a></p>
        {/* eslint-disable-next-line camelcase */}
        <p class="comment_count">{thread.comment_count} comment(s)</p>
        <hr />
    </>
})
