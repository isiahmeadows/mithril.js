import * as V from "./internal/vnode"
import {Element} from "./internal/dom"

type TransitionStyle = object & {[key: string]: TransitionStyleValue}
type TransitionStyleValue = [string, string, string, string]
type ClassOrStyle = string | TransitionStyle

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

type TransitionAttrs = V.VnodeAttributes & {
    in?: APIOptional<ClassOrStyle>
    out?: APIOptional<ClassOrStyle>
    move?: APIOptional<ClassOrStyle>
    afterIn?(): Await<void>
    afterOut?(): Await<void>
    afterMove?(): Await<void>
}

function classOrStyleToAttrs(classOrStyle: ClassOrStyle): V.VnodeAttributes {
    return {
        class: typeof classOrStyle === "string" ? classOrStyle : void 0,
        style: typeof classOrStyle === "object" ? classOrStyle : void 0,
    }
}

interface ScheduleTransitionState {
    // TODO: compress to bit mask
    adding: boolean
    moving: boolean
    removed: boolean
    closed: boolean
    ref: Maybe<Element & V.RenderTarget>
    closeRemove: Maybe<V.CloseCallback>
}

function getOpacity(ref: Element) {
    return +ref.ownerDocument.defaultView
        .getComputedStyle(ref)
        .getPropertyValue("opacity")
}

function ScheduleTransition(
    attrs: TransitionAttrs,
    info: V.ComponentInfo<ScheduleTransitionState>
) {
    const state = info.init(() => ({
        adding: attrs.in != null,
        moving: false,
        removed: false,
        closed: false,
        ref: void 0,
        closeRemove: void 0,
    }))

    info.whenReady((ref) => {
        state.ref = ref as Any as Element & V.RenderTarget
        return void 0 as Any as V.WhenReadyResult
    })

    const vnodes: V.Vnode[] = []

    if (attrs.in != null && state.adding) {
        vnodes.push(
            classOrStyleToAttrs(attrs.in),
            {on: {transitionend() {
                state.adding = false
                if (typeof attrs.afterIn === "function") return attrs.afterIn()
            }}}
        )
    } else {
        vnodes.push(void 0, void 0)
    }

    if (attrs.out != null) {
        info.whenRemoved(() => new Promise<void>((resolve, reject) => {
            function invokeAfterOut() {
                if (typeof attrs.afterOut === "function") {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    new Promise((resolve) => resolve(attrs.afterOut!()))
                        .catch((e) => { info.throw(e as V.ErrorValue, false) })
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            info.render(state.ref!, () => [
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                classOrStyleToAttrs(attrs.out!),
                {on: {transitionend(_: V.EventValue, capture: V.Capture) {
                    capture.redraw()
                    state.removed = true
                    const close = state.closeRemove
                    state.closeRemove = void 0
                    if (close != null) {
                        resolve(close())
                        invokeAfterOut()
                    }
                }}}
            ])
                .then((close) => {
                    if (state.removed) {
                        resolve(close())
                        invokeAfterOut()
                    } else {
                        state.closeRemove = close
                    }
                }, (e) => {
                    // We should never get here absent either a renderer bug or
                    // some byzantine fault, but let's still handle it just in
                    // case.
                    state.removed = true
                    reject(e as Error)
                    // Let users still see completion, even though it wasn't
                    // successful.
                    invokeAfterOut()
                })
        }) as Any as V.WhenRemovedResult)
    }

    if (info.isParentMoving()) {
        // TODO
        // Note: account for `move` stuff being removed mid-animation
    }

    return vnodes
}

export function transition(opts: string | TransitionAttrs): V.Vnode {
    return V.create(V.Type.Link, [
        ScheduleTransition as Any as V.KeyValue,
        V.create(V.Type.State, [
            ScheduleTransition as Any as
                V.Component<TransitionAttrs, V.StateValue>,
            typeof opts === "string"
                ? {
                    in: `${opts}--in`,
                    out: `${opts}--out`,
                    move: `${opts}--move`,
                } as TransitionAttrs
                : opts,
        ]),
    ])
}
