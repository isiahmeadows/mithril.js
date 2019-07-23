import {render} from "./dom.mjs"

// TODO: support mutation events as a fallback - see mutation observer polyfills
// for IE for how to correctly fall back to mutation events.

function makeSet() {
    // eslint-disable-next-line no-undef
    return typeof Set === "function" ? new Set() : {
        k: [],
        size: 0,
        has: function (key) { return this.k.indexOf(key) >= 0 },
        add: function (key) {
            var index = this.k.indexOf(key)
            if (index < 0) { this.k.push(key); this.size++ }
        },
        delete: function (key) {
            var index = this.k.indexOf(key)
            if (index >= 0) { this.k.splice(index, 1); this.size-- }
        },
        clear: function () { this.k = [] },
        forEach: function (func) {
            for (var i = 0; i < this.k.length; i++) func(this.k[i])
        },
    }
}

export function select(root, selectors) {
    var window = root.ownerDocument.defaultView
    // eslint-disable-next-line no-undef
    var rootList = typeof Map === "function" ? new Map() : {
        k: [],
        v: [],
        has: function (key) { return this.k.indexOf(key) >= 0 },
        get: function (key) {
            var index = this.k.indexOf(key)
            return index >= 0 ? this.v[index] : undefined
        },
        set: function (key, value) {
            var index = this.k.indexOf(key)
            if (index >= 0) {
                this.v[index] = value
            } else {
                this.k.push(key)
                this.v.push(value)
            }
        },
        delete: function (key) {
            var index = this.k.indexOf(key)
            if (index >= 0) {
                this.k.splice(index, 1)
                this.v.splice(index, 1)
            }
        },
        clear: function () {
            this.k = []
            this.v = []
        },
        forEach: function (func) {
            for (var i = 0; i < this.k.length; i++) func(this.v[i], this.k[i])
        },
    }
    var paths = Object.keys(selectors)
    var vnodes = paths.map(function (sel) { return selectors[sel] })
    var scheduled = false
    var addedList, removedList

    function isWithinRoot(node) {
        while (node != null) {
            // Only check nodes that have Mithril's `_ir` property.
            if ("_ir" in node && rootList.has(node)) return true
            node = node.parentNode
        }
        return false
    }

    function buildSelectors() {
        rootList.clear()
        for (var i = 0; i < paths.length; i++) {
            var selected = root.querySelectorAll(paths[i])
            for (var j = 0; j < selected.length; j++) {
                rootList.set(selected[j], vnodes[i])
            }
        }
    }

    buildSelectors()

    function clear() {
        var map = rootList
        rootList = paths = vnodes = addedList = removedList = null
        map.forEach(function (_, root) { render(root, null) })
    }

    function patch() {
        // Get local references to these values.
        var added = addedList
        var removed = removedList

        // Reset everything
        scheduled = false
        addedList = removedList = null

        // Remove nodes that aren't tracked.
        removed.forEach(function (node) {
            render(node, null)
        })

        // If no non-managed nodes were added, abort.
        var count = 0
        added.forEach(function (node) {
            if (isWithinRoot(node)) count++
        })
        if (count === added.length) return

        // Now, rebuild our selector list - easier than implementing our own
        // selector engine. (I wish the DOM provided something like
        // `elem.matchesWithin(sel, parent)`.)
        buildSelectors()

        rootList.forEach(function (vnode, root) { render(root, vnode) })
    }

    if (typeof window.MutationOberver === "function") {
        var obs = new window.MutationOberver(function (records) {
            // Remove records that are within our managed tree. If no more
            // records remain, abort. This is easy, but it also has to be fast,
            // as it's called on *every* render and prevents accidental
            // recursion. It could frequently contain thousands of nodes.
            //
            // It's also why I split the loop - it's to ensure more predictable
            // branching and to work with the CPU memory pipeline. (It's almost
            // never a mix.)
            for (var i = 0; i < records.length; i++) {
                if (isWithinRoot(records[i].target)) {
                    records[i] = null
                    var count = records.length
                    var first = i + 1
                    while (++i < records.length) {
                        if (isWithinRoot(records[i].target)) {
                            records[i] = null
                            count--
                        }
                    }
                    if (count === 0) return
                    i = first
                    records[0] = records[i]
                    while (++i < records.length) {
                        if (records[i] == null) records[count++] = records[i]
                    }
                    records.length = count
                }
            }

            // And schedule the rest.
            // Now, for the interesting parts.
            // First, normalize our representations. Added nodes and removed
            // nodes are placed into single lists. This makes things much nicer
            // for CPUs.
            if (!scheduled) {
                addedList = makeSet()
                removedList = makeSet()
            }

            for (var i = 0; i < records.length; i++) {
                var added = records[i].addedNodes
                var removed = records[i].removedNodes
                for (var i = 0; i < added.length; i++) {
                    addedList.add(added[i])
                }
                for (var i = 0; i < removed.length; i++) {
                    // Remove tracked nodes and schedule for removal.
                    rootList.delete(removed[i])
                    removedList.add(removed[i])
                }
            }

            if (scheduled) return
            scheduled = true
            window.requestAnimationFrame(patch)
        })

        obs.observe(root, {
            childList: true,
            subtree: true,
        })

        return function () {
            if (obs) {
                obs.disconnect()
                obs = null
                clear()
            }
        }
    } else {
        return clear
    }
}
