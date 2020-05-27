[*Up*](README.md)

# Virtual Scroller API

TODO: https://github.com/ArthurClemens/mithril-infinite/tree/master/packages/mithril-infinite

- Leverage `m(Use)` to handle data fetching and such.
- Structure API like this, exported from `mithril/virtual`:
    - `m(VirtualScroller, {items, on: {start, end, overscrollstart, overscrollend}, scrollAxis?, autosize?, cushion?, preload?, view?})`
        - `items` - A paginator instance or an array of items. (Required)
            - Arrays can be updated, but paginators are assumed to be static.
        - `on.start()` - Start of list has been reached.
            - This is *not* fired on load.
        - `on.end()` - End of list has been reached.
            - This is *not* fired on load.
        - `on.overscrollstart()` - The user over-scrolled past the start of the list, and no more buffered entries exist to render.
        - `on.overscrollend()` - The user over-scrolled past the end of the list, and no more buffered entries exist to render.
        - `on.error(e)` - An error occurred during fetching.
            - If this is not present, uncaught fetch errors are propagated as fatal.
        - `scrollAxis: "horizontal" | "vertical" = "vertical"` - Which axis it should scroll and fetch items for.
        - `autosize = true` - Whether to automatically adjust size based on the rendered contents.
        - `cushion = 300` - The cushion size in CSS pixels, used to determine the minimum acceptable bound to pre-fetch.
        - `preload = 1` - Number of pages to request initially.
            - There's usually no need to modify this except for SSR.
            - The actual act of loading is not performed until after the initial DOM is rendered.
            - This does not affect subsequent loads - any number of requests could be made.
            - Note: these are *pages*, not necessarily individual *items* within them.
        - `view: ({offset, items, padStart, padEnd, fetchingStart, fetchingEnd}) => vnode` - Render the scroller. (Required)
            - `offset` is an integer offset retrieved from the paginator.
            - `items` are the list of items to render. This is not necessarily the same as the `items` attribute or its `.items` property if it's a paginator - it may contain more or less.
            - `padStart` and `padEnd` are fragments to ensure the scroll position remains restored whenever you scroll around.
            - `fetchingStart` and `fetchingEnd` are set to `true` if values
            - `vnode` is a DOM vnode to render the parent to. Styles are applied to it as appropriate.
            - A `virtual` environment key is set to the same value as `virtual` above, with a couple methods:
                - `virtual.setScroll(elemOffset)` - Set the scroll offset relative to the top or left of the containing element in CSS pixels.
                - `virtual.scrollToItem(itemOffset)` - Set the scroll offset to the top left of the given item, relative to the current item.
            - TODO: try to factor overscroll into this somehow.
    - Request pagination:
        - `paginator = paginateBatch(initial?, async (start) => values?)` - Create a paginator that fetches constant-sized batches starting at a given offset and buffers them accordingly.
            - `values` is an array of values to pass to `view`.
            - `initial: (item) => boolean` - Check whether this is the initial item. (Exists in case you need to scroll to a particular item.)
            - Previous offsets are tracked via an internal stack.
        - `paginator = paginateScan(initial?, async (prev?) => ({next?, values}))` - Create a paginator that fetches constant-sized batches starting at an optional start cursor and buffers them accordingly. Previous cursors are persisted, but not their values. Previous cursors are stored as appropriate.
            - `values` is an array of values to pass to `view`.
            - `initial: (item) => boolean` - Check whether this is the initial item. (Exists in case you need to scroll to a particular item.)
            - `next` represents the next cursor. If this is `null` or `undefined`, that's considered the endpoint.
            - Previous cursors are tracked via an internal stack.
        - `paginator = paginateWalk(initial?, async (prev?) => ({prev?, next?, values}))` - Create a paginator that fetches constant-sized batches starting at an optional start cursor and buffers them accordingly. Previous cursors are persisted, but not their values. Previous cursors are stored as appropriate.
            - `values` is an array of values to pass to `view`.
            - `initial: (item) => boolean` - Check whether this is the initial item. (Exists in case you need to scroll to a particular item.)
            - `next` represents the next cursor. If this is `null` or `undefined`, that's considered the endpoint.
            - `prev` represents the previous cursor. If this is `null` or `undefined`, that's considered the start point.
        - `paginator.fetchNext()` - Fetch more after the end, returns promise resolved on retrieval.
        - `paginator.fetchPrevious()` - Fetch more after the start, returns promise resolved on retrieval.
        - `paginator.hasNext()` - Whether more items exist after the end of this paginator's current position.
            - This also determines whether overscroll has any effect.
        - `paginator.hasPrevious()` - Whether more items exist after the start of this paginator current position.
            - This also determines whether overscroll has any effect.
        - `paginator.offset` - Get the current overall offset, to later potentially plug into `virtual.scrollToItem(...)`.
        - `paginator.items` - Get the current list of items.

### Why?

TODO
