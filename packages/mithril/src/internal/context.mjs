// Note: the original document + the target namespace is retrieved from this.
export function makeDOMMetadata(root, current) {
    var document = current.ownerDocument
    var win = document.defaultView

    // Maybe the child isn't an HTML element?
    // Maybe the root's document doesn't own this child somehow?
    if (win == null || root.ownerDocument !== document) {
        win = root.ownerDocument.defaultView
        if (win == null || win.document !== document) {
            try {
                // eslint-disable-next-line no-undef
                win = window
                // Maybe we're not in an HTML-like environment at all?
                if (
                    win.document !== document &&
                    win.document !== root.ownerDocument
                ) throw 0
            } catch (_) {
                win = undefined
            }
        }
    }

    return {
        isStatic: false,
        type: "mithril/dom",
        document: document,
        window: win,
    }
}

export function makeStringMetadata(target, win) {
    if (win == null) {
        // Let's see if we can find a window somehow.
        // eslint-disable-next-line no-undef
        try { win = window } catch (_) { /* ignore */ }
    }

    return {
        isStatic: true,
        type: "mithril/string",
        document: win != null ? win.document : undefined,
        window: win,
    }
}
