import * as V from "./internal/vnode"
import {Element} from "./internal/dom"
import {assign} from "./internal/util"
import {StyleObject} from "./internal/normalize-attrs"

type ClassOrStyle = string | StyleObject

// Warning: dynamic CSS transitions are very, *very* complicated and
// counterintuitive to support generically. I've gone through several links
// while implementing this (listed below) as well as consulting the spec
// directly and using a playground for several days, just to get this right.
// Unless you *really* know what you're doing, you should edit with
// ***EXTREME*** caution.
//
// This list below is not meant to be exhaustive, BTW.
//
// - https://drafts.csswg.org/css-transitions/
// - https://www.smashingmagazine.com/2013/04/css3-transitions-thank-god-specification/#a1
// - https://aerotwist.com/blog/flip-your-animations/ + related source code:
//   https://github.com/googlearchive/flipjs/
// - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Transitions/Using_CSS_transitions
// - https://www.the-art-of-web.com/css/css-animation/
// - https://cssanimation.rocks/list-items/ (dead-end, doesn't include move animations)
// - https://medium.com/@kswanie21/css3-animations-with-transitions-transforms-5a9c01e5efb5
// - https://blog.alexmaccaw.com/css-transitions
// - https://css-tricks.com/almanac/properties/t/transition/
// - https://css-tricks.com/controlling-css-animations-transitions-javascript/
// - https://www.adobe.com/devnet/archive/html5/articles/using-css3-transitions-a-comprehensive-guide.html
// - Vue's source code (they're among the few that natively implement this as a
//   virtual DOM library/framework)

// TODO: render each animation separately, and have Mithril resolve styles
//
// This is all one single monolithic component as there's also several edge
// cases to address:
//
// - Remove while add/move transition is playing
// - Move while add transition is playing

interface TransitionOptions {
    in?: APIOptional<ClassOrStyle>
    out?: APIOptional<ClassOrStyle>
    move?: APIOptional<ClassOrStyle>
    afterIn?(): Await<void>
    afterOut?(): Await<void>
    afterMove?(): Await<void>
}

interface Snapshot {
    x: number
    y: number
    h: number
    w: number
    v: number
}

interface Delta {
    dx: number
    dy: number
    dh: number
    dw: number
    dv: number
}

interface TransitionState {
    // TODO: compress to bit mask
    adding: boolean
    moving: boolean
    moved: boolean
    removed: boolean
    ref: Maybe<Element & V.RenderTarget>
    resolve: Maybe<() => void>
    first: Maybe<Snapshot>
    last: Maybe<Snapshot>
    delta: Maybe<Delta>
}

function makeSnapshot(ref: Element) {
    const rect = ref.getBoundingClientRect()
    const opacity = +ref.ownerDocument.defaultView
        .getComputedStyle(ref)
        .getPropertyValue("opacity")

    return {
        x: rect.left,
        y: rect.top,
        h: rect.height,
        w: rect.width,
        v: opacity,
    }
}

export function transition(
    opts: APIOptional<string | TransitionOptions>,
    child: V.Vnode
): V.Vnode {
    let resolvedOpts: TransitionOptions

    if (opts != null && typeof opts === "object") {
        resolvedOpts = opts
    } else if (typeof opts === "string") {
        resolvedOpts = {
            in: `${opts}--in`,
            out: `${opts}--out`,
            move: `${opts}--move`,
        }
    } else {
        throw new TypeError("`opts` must be a string or object.")
    }

    if (
        child == null || typeof child !== "object" ||
        (child as V.VnodeNonPrimitive)["%"] !== V.Type.Element
    ) {
        throw new TypeError("`child` must be an element vnode.")
    }

    return V.create(V.Type.State, ((info: V.ComponentInfo<TransitionState>) => {
        const state = info.init(() => ({
            adding: resolvedOpts.in != null,
            moving: false,
            moved: false,
            removed: false,
            ref: void 0,
            resolve: void 0,
            first: void 0,
            last: void 0,
            delta: void 0,
        }))

        info.whenReady((ref) => {
            state.ref = ref as Any as Element & V.RenderTarget
            return void 0 as Any as V.WhenReadyResult
        })

        const initialAttrs = (child as V.VnodeElement)._[1]
        let attrsToSet = assign({}, initialAttrs) as V.AttributesObject

        if (state.delta) {
            // TODO: set transition for move
        }

        let ontransitionend: APIOptional<V.EventListener>
        attrsToSet.on = {} as V.EventsObject
        if (initialAttrs.on != null) {
            ontransitionend = initialAttrs.on.transitionend
            assign(attrsToSet.on, initialAttrs.on as object)
        }
        attrsToSet.on.transitionend = (ev, capture) => {
            let ps: AwaitPromise<void>[] = []
            let error: Any = ps

            if (typeof ontransitionend === "function") {
                try {
                    const p = ontransitionend(ev, capture)
                    if (p != null && typeof p.then === "function") {
                        ps.push(p)
                    }
                } catch (e) {
                    error = e
                }
            } else {
                // Simulate the default behavior.
                capture.redraw()
            }

            if (state.adding) {
                state.adding = false

                try {
                    if (typeof resolvedOpts.afterIn === "function") {
                        const p = resolvedOpts.afterIn()
                        if (p != null && typeof p.then === "function") {
                            ps.push(p)
                        }
                    }
                } catch (e) {
                    error = e
                }
            } else if (state.moving) {
                state.moving = false
                // TODO: element moved

                try {
                    if (typeof resolvedOpts.afterMove === "function") {
                        const p = resolvedOpts.afterMove()
                        if (p != null && typeof p.then === "function") {
                            ps.push(p)
                        }
                    }
                } catch (e) {
                    error = e
                }
            } else if (state.removed) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                state.resolve!()
                // TODO: account for `move` stuff being removed mid-animation

                try {
                    if (typeof resolvedOpts.afterOut === "function") {
                        const p = resolvedOpts.afterOut()
                        if (p != null && typeof p.then === "function") {
                            ps.push(p)
                        }
                    }
                } catch (e) {
                    error = e
                }
            }

            // Skip the overhead of promise awaiting if we can.
            if (error !== ps) throw error
            if (ps.length === 0) return void 0
            if (ps.length === 1) return ps[0]
            // TODO: implement this not using an ES2020 function.
            return Promise.allSettled(ps) as Any as Await<void>
        }

        if (resolvedOpts.out != null) {
            info.whenRemoved(() => new Promise(resolve => {
                state.removed = true
                state.resolve = resolve
            }))
        }

        if (state.moving) {
            // TODO: add moving classes
        }

        if (state.moved) {
            // TODO: start transition
        }

        let requestMove = false

        if (info.isParentMoving() && resolvedOpts.move != null) {
            requestMove = true
            state.last = state.first
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            state.first = makeSnapshot(state.ref!)
        }

        let classString: Maybe<String>
        let styleObject: Maybe<{[key: string]: Any}>
        let classIsNew = initialAttrs.class != null
        let styleIsNew = initialAttrs.style != null

        if (state.adding && resolvedOpts.in != null) {
            if (typeof resolvedOpts.in === "object") {
                if (styleIsNew) styleObject = assign({}, initialAttrs.style)
                styleIsNew = false
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                assign(styleObject!, resolvedOpts.in)
            } else {
                if (classIsNew) classString = `${initialAttrs.class}`
                classIsNew = false
                classString += ` ${resolvedOpts.in}`
            }
        }

        if (state.moving && resolvedOpts.move != null) {
            if (typeof resolvedOpts.move === "object") {
                if (styleIsNew) styleObject = assign({}, initialAttrs.style)
                styleIsNew = false
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                assign(styleObject!, resolvedOpts.move)
            } else {
                if (classIsNew) classString = `${initialAttrs.class}`
                classIsNew = false
                classString += ` ${resolvedOpts.move}`
            }
        }

        if (classIsNew) attrsToSet.class = classString
        if (styleIsNew) attrsToSet.style = styleObject

        const oldData = (child as V.VnodeElement)._
        const newData: V.VnodeElement["_"] = [oldData[0], attrsToSet]
        for (var i = 2; i < oldData.length; i++) newData.push(oldData[i])
        newData.push(V.create(V.Type.State, (info) => {
            info.whenReady((ref) => {
                state.ref = ref as Any as Element & V.RenderTarget
                /* eslint-disable @typescript-eslint/no-non-null-assertion */
                if (requestMove) {
                    state.last = makeSnapshot(state.ref)
                    const dx = state.first!.x - state.last.x
                    const dy = state.first!.y - state.last.y
                    const dh = state.first!.h - state.last.h
                    const dw = state.first!.w - state.last.w
                    const dv = state.first!.v - state.last.v
                    if (dx || dy || dh || dw || dv) {
                        state.delta = {dx, dy, dh, dw, dv}
                        state.moving = true
                        // Loop back around to add the moving styles
                        info.redraw()
                    } else if (state.moving) {
                        state.moving = false
                        state.moved = true
                        // Note: this is intentionally unused - we're just forcing
                        // a layout.
                        state.ref.offsetHeight
                        // Loop back around to add the transition class
                        info.redraw()
                    }
                }
                /* eslint-disable @typescript-eslint/no-non-null-assertion */
                return void 0 as any as V.WhenReadyResult
            })
            return void 0
        }))
        return V.create(V.Type.Element, newData)
    }) as Any as V.StateInit<V.StateValue>)
}
