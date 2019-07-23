[*Up*](README.md)

# Events

Event and ref handling is significantly changed, to open up a new possibilities for how components can interact with each other and to encourage composable reuse in several new cases. Instead of it being based on attributes, it's now based on vnodes. There's a few special attributes that dictate it:

- `afterCommit: callback` - Schedules `callback` to be called with the closest parent element's or component's ref after all tree updates have been committed. It's scheduled in iteration order with the parent ref that exists after all changes have been committed. Note: this *does not* penetrate component boundaries to find the ref, and it will use `undefined` if it can't find one.
	- You can optionally return new attributes to apply from this.
- `onevent: callback`, `onevent: [callback, options = false]` - Schedules `callback` to be called when an event named `"event"` is emitted, with optional event listener options for DOM events. `callback` is called with the raw event and a `capture()` callback to prevent the default action and stop propagation if applicable. If the callback returns a promise that eventually rejects, it's translated into an event listener error. If it returns literally `false`, it's equivalent to invoking `capture()`. Otherwise, the return value is ignored.
	- Invoke `capture()` to cause the originating component's `events.emit(event, ev)` to return `false`.
	- Invoke `capture()` to have the DOM handler invoke `ev.preventDefault(); ev.stopPropagation()`. (This only occurs *after* all listeners have been invoked.)
	- Invoking `capture()` from one event doesn't stop further handlers from executing. This can only be done for DOM events via `ev.stopImmediatePropagation()`, and it's intentionally verbose and not recommended.
	- The reason `capture` exists is to help simplify async handlers. It's *really* simple to implement.
    - You can capture a `"click"` event in the capture phase (instead of the bubble phase) via `onclick: [callback, {capture: true}]`.
	- You can pass an event listener object with event listener options also on it, in case you want to set those.

## Refs

Refs can be requested by passing `afterCommit: callback` to get the underlying value, where `func` accepts the parent node's ref and returns an optional cleanup function. Most vnodes have a ref of some kind they can expose:

- Elements and portals expose the underlying value.
- Components expose whatever ref is returned from them via `setRef(ref, ...children)`, or `undefined` if they don't return one.
- Fragments and keyed fragments expose an array of child refs.
- Text slices expose the underlying text node.
- Holes and dynamic vnodes expose literally `undefined`.
- Context and config vnodes expose whatever the view inside their callback exposes.
- Replacer vnodes expose whatever their wrapping vnode exposes.

### Why not just provide a `vnode.dom`?

Technically, I could just provide `vnode.dom` + an `oncreate`/`onupdate` equivalent instead of `ref`, but there's several reasons why I'm not:

1. It's generally poor practice to try to mutate the DOM outside of event handlers (which provide it via `ev.target.value`) or a batched request. Forcing batching also keeps performance up and running.
1. It makes it impossible to access an uninitialized element, simplifying types and avoiding potential for bugs.
1. It complicates access for simpler cases.
1. 1 hook is better than 2. I'd need a hook for `oncreate`/`onupdate` anyways, so it's much simpler to do it this way.

### Differences from React

- Refs are always invoked on every update that reaches them, as they're not simply exposure mechanisms but also control mechanisms.
- [React cares about ref identity](https://reactjs.org/docs/refs-and-the-dom.html#caveats-with-callback-refs), but this complicates the model a lot, especially when it's designed only for exposure.
- You can see element refs in action in [the TodoMVC example](https://github.com/isiahmeadows/mithril.js/tree/redesign/examples/todomvc/).

## Component emitters

Components emit events through a second parameter `events` that wraps all the nasty boilerplate transparently.

- `events.isListenedTo("event")` - Whether a particular event type is being listened for. This knows even when attributes aren't subscribed to.
- `events.getListenedTo()` - Get the list of events currently listened to.
- `events.emit(event, value)` - Emit an event. This returns `false` if the emit was prevented or `true` otherwise. The event type can be any string, symbol, or numeric event.

Note that `on${event}` attributes outside `rawAttrs:` are strictly censored at the hyperscript level, as you should be using the above syntax. No, really - it's not that much more complicated, and it's much easier to change down the road. It's also syntactically more flexible.

## Why change the event receiver model?

Events, as they are today, are clunky, not easily composed, and hard to reuse. But not only that, components are contending with attributes and built-in events in a way that it becomes harder to use. It also sometimes interferes with code comprehension because you'll have the tag, attributes, then a giant block of unrelated code, *then* the children. And sometimes, those children are awfully important for context, something that's often the case with forms and buttons.

But to add to all that, this model is also substantially more flexible. I can specify duplicate listeners with different event listener options for each. I can even specify a passive listener side-by-side with an equivalent non-passive one. That is not currently possible with *any* other virtual DOM framework I'm aware of aside from React, who has it behind an experimental API.

And finally, [it leaves the door open for some useful event helpers](../events.md#event-handler-helpers) to simplify common things you often need to listen to.

### Where did this come from?

It was in large part inspired by Dominic Gannaway's work on events for React, but with the mental model shifted to be a little more direct. Here's a few links for context:

- https://gitter.im/mithriljs/mithril.js?at=5d363870d1cceb1a8da44199
- https://twitter.com/isiahmeadows1/status/1158771013137707009
- https://gitter.im/mithriljs/mithril.js?at=5d49affb475c0a0feb0e4963
