# Rationale

There's a lot of big decisions here that require some explanation.

### Removing global redraws

I killed this because in general, global redraws *do* frequently get in the way. You'll end up making a lot of unnecessary updates, and this *does* become a problem when you're managing mounted subtrees. It also just generally doesn't scale well, and it's already a common request to have subtree redraws.

You can emulate Mithril's current API by adding a subscription mechanism that invokes sync/async redraws as necessary. The [TodoMVC example](https://github.com/isiahmeadows/mithril.js/blob/v3-redesign/examples/todomvc/todomvc.mjs) does this very thing, and you can still get a global redraw using this simple wrapper:

```js
import render from "mithril/render"
const subtrees = new Map()

export function mount(root, func) {
    if (func != null) {
        render(root, (render, context) => {
            subtrees.set(root, {context, func})
            render(func())
        })
    } else {
        subtrees.delete(root)
        render(root)
    }
}

export function redraw() {
    for (const {context, func} of subtrees.values()) {
        context.scheduleLayout(() => {
            context.renderSync(func())
        })
    }
}

export function redrawSync() {
    for (const {context, func} of subtrees.values()) {
        context.renderSync(func())
    }
}
```

### Changing rendering to be active, not reactive

Rather than Mithril choosing when trees are generated, components choose that and Mithril simply chooses when to commit the tree. Here's the main consequences of this:

- Autoredraw by default is gone. [You can still wrap a component to provide this functionality local to a component](core.md#closure-components), but it's not there by default.
- There is no `view` method. When necessary, you can create your own complicated system, but a simple `Cell.map(attrs, (attrs) => view)` is sufficient for most cases.
- Instead of receiving attributes directly, you receive a cell that emits updated attributes to its subscribers.

The general concept behind this is that if you want to update the tree, update the tree. If you don't, just don't. Either way, you're not asking for permission - you're just doing what you want to. The key difference here is that you're not *reacting to new attributes and state by generating a view*, but just *reacting to new attributes and state* and acting appropriately. Sometimes, that "acting appropriately" is firing a request, and other times, it's rendering a view. Sometimes, the new attributes match the old attributes and so you can react by just doing nothing.

The main reason why I first made redraws explicit was performance, but the real wins came from making rendering active rather than reactive and giving components all the control over that. It let me shed a few more hooks in the process, so rendering optimizations come out and decompose much more naturally.

A [recent Overreacted post](https://overreacted.io/writing-resilient-components/) detailed a few principles about writing good components:

1. Don’t stop the data flow
2. Always be ready to render
3. No component is a singleton
4. Keep the local state isolated

Each of these are very thoroughly addressed:

1. In general, this isn't an area a framework can help you in. In practice, this is entirely up to the component author. However, making attributes streams that you can eventually plug into attributes and children *does* make it easier to keep the data flow going.
2. By putting components in control of when they can render, it's only about being ready to receive updates. This is *much* simpler to do and it's something the framework can enforce by design. By actually separating the two concerns of receiving attributes and rendering at the framework level, it makes the related issues of blocking data flow much clearer and more readily apparent in most cases. (Note that the advice for also checking event handlers when diffing attributes still holds.) And of course, you can't just receive the first set of attributes - you either don't handle any attributes or you handle every single attributes object you get. There is no in-between and no exception for the first attributes received. (And no, `attrs(once(...))` doesn't count as not handling attributes - you're handling subsequent updates by ignoring them as they didn't come first.)
3. This trap is easy to run into at any point, but the very hard abstraction nature of this redesign makes it much harder to do it without at least noticing that it shouldn't be so complicated. So the better way is also the more natural way, and so the easy route is almost *always* the best route. And of course, when possible, we should be optimizing for what people *naturally do* rather than just telling them what not to do.
4. This is more or less the same as 3, just referring to accidentally global state rather than intentionally global state.

### Moving children into the attributes

The vnode children have been moved into the attributes.

This is one of the few things React did *correctly* from the start. It's *much* easier to proxy attributes through when children are packaged like any other attribute. It's also much easier to pass them around sensibly - you don't need to specially package them.
