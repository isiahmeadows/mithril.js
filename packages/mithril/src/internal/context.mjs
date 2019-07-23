import version from "./version.mjs"

// Note: these are only allocated for config vnodes

function getTarget(fallback, namespaceURI) {
    if (namespaceURI === "http://www.w3.org/1999/xhtml") return "html"
    if (namespaceURI === "http://www.w3.org/2000/svg") return "svg"
    if (namespaceURI === "http://www.w3.org/1998/Math/MathML") return "mathml"
    return fallback
}

// Note: the original document + the target namespace is retrieved from this.
export function makeDOMMetadata(root, current) {
    var document = current.ownerDocument
    var namespaceURI = current.namespaceURI
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
        version: version,

        document: document,
        window: win,
        target: getTarget("xml", namespaceURI),
        xmlns: namespaceURI,
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
        version: version,
        target: target,

        document: win != null ? win.document : undefined,
        window: win,
    }
}
