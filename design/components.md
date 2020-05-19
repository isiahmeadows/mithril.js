[*Up*](README.md)

# Component API

Components are very simple and consistent. Lifecycle is easy to process, easy to understand as it's inherent with the model. State uses closures for simplicity. Here's what they look like:

```js
function Comp(attrs, info, env) {
    const state = info.init(() => initialState)
    return view
}
```

- `attrs` is the current attributes, set to a frozen object. Event handlers are included for easier event delegation, but they're merged.
- `info` is the component info, necessary for basic tree reflection.
- `env` is the current environment, set to a frozen object. Its identity is an implementation detail, and it's not necessarily unique.
- `initialAttrs` and `initialEnv` are as you would expect, the initial attributes and environment, respectively
    - In general, avoid using these.
- `view` is the child vnode subtree to render.

This is inherently fairly fast:

- Engines implement functions as basically `{code, closure}` pairs, and with direct function calls, they don't need to do a method lookup. They can just grab a known address and do a computed call or jump into the closure's code body. So the stateful variant is as fast to call as the stateless variant.
- [This blog post](https://benediktmeurer.de/2018/03/23/impact-of-polymorphism-on-component-based-frameworks-like-react/) explains why stuff like React's `inst.render()` and v2's `vnode.state.view(vnode)` is so slow - the engine erroneously tries to cache the property access when it shouldn't. This limits it to exactly one immediate property access per view render.
- As the various handlers aren't persisted between renders, collecting them is easier and it's possible to optimize for only sometimes needing a handler. They're also relegated to vnodes, making them optional by default and separate from components, thus reducing memory requirements for them.
- 99% of what aren't functions are small static objects that are easily recycled and can largely occupy the nursery. And 99% of allocations of any significant size in views are either arrays, strings, or closures, things engines already optimize very well.

The existing `oninit`, `onbeforeupdate`, and `view` lifecycle hooks are all merged into this model not as hooks but just as part of the data flow.

- `oninit` → component-level call where `info.isInitial() === true`
- `view` → any call, pass as `view:` value
- `onbeforeupdate` → conditionally return `view: m.RETAIN` with old handlers

For convenience and consistency, `attrs.children` is set to a resolved children array, where attribute children and refs are resolved to holes. (They've already been addressed.)

## Event handlers

The component receives event handlers a little differently. Specifically:

- `attrs.on.event(value, capture?)` - Invokes `on.event(value, capture)` for each such listener and returns `true` if any of them invoked `capture.event()`.
    - If `capture` is not passed, one is made internally.
    - Note: the redraw is skipped if either it's not listened to or if all listeners call this.
- Event listeners are only defined if one event is listened to, but multiple event listeners are merged and single event listeners are normalized.

## Component info

The component info object (`info` below) contains all the necessary bits for components to manage themselves within a tree, including scheduling redraws and the like.

- Whether the component is active (and not yet removed): `test = info.isActive()`
    - `test` is `false` if the component was ever removed, `true` otherwise.

- Current state: `state = info.state`
    - You can use this to persist state across multiple renders.

- Initialize and link state: `state = info.init(callback)`
    - `initialState = callback()` creates and returns the initial state.
    - This is just sugar for `info.isInitial() ? (info.state = callback()) : info.state`, though it's a primitive for convenience.

- Throw error: `info.throw(value, nonFatal = false)`
    - This triggers the usual exception handling mechanism, the same one used for event listeners and synchronous view errors.

- Invoke redraw: `promise = info.redraw()`
    - Returns a promise that resolves once the redraw is fully committed.
    - This currently schedules a redraw for the enclosing root, but this could change in a future update.

- Is parent moving: `info.isParentMoving()`
    - This throws an error if this component is not currently rendering and the component view has already been initialized.
    - This allows transitions to work without having to know about their surrounding context.
    - It's virtually zero-cost to implement, anyways, so it's an easy, obvious thing to add.

- Is initial render: `info.isInitial()`
    - This throws an error if this component is not currently rendering and the component view has already been initialized.
    - This is technically discernible in userland, but it's provided here for convenience. It's effectively zero-cost to implement, anyways.

- Render type: `info.renderType()`
    - This gets the render type. For the DOM renderer, it returns `"dom"`, and for the static renderer, it returns `"static"`. Other renderers are encouraged to return their own values for these.

- Set component ref: `info.ref = ref`
    - This may be called at any point in time, but `info.whenReady` callbacks are just invoked as `callback(info.ref)` where `info` is the parent `info` for that callback.
    - The initial `ref` is `undefined`, and previous refs are persisted. It can also be set to any value.
    - This is different from React's `useImperativeHandle` in that it lets you set the ref at any time.

- Set environment key: `info.setEnv(key, value)`
    - `key` - The key to set in the child environment, as an object property.
        - Use symbols if you need guaranteed uniqueness.
    - `value` - The value to set the key to.
    - If a previous key existed, this overwrites that key for the environment passed to the children.
    - This does *not* affect the `env` passed to the component itself, only the environment passed to children.
    - Environment is updated via roughly `childEnv = Object.freeze({__proto: parentEnv, ...keys})`.
    - This works similarly to React's context API, but is much simpler and lower-level.

- Schedule callback to run on component commit: `info.whenReady(callback)`
    - `await callback(ref)` - Called once tree is live and ready for direct manipulation, awaited to propagate any errors that may arise from it.
        - This also delays resolution of the outer render/redraw call.
    - This is always scheduled for the current render pass only. During stateful component initialization, it's only scheduled for the first render pass, not subsequent ones. (Tip: don't use this during stateful component initialization. It doesn't do what you think it will.)
    - This throws an error if this component is not currently rendering and the component view has already been initialized.
    - If you invoke `info.redraw()` here synchronously, the component gets redrawn again asynchronously but in the same microtask. (Translation: it just loops back around again.)

- Schedule callback to run on component removal: `info.whenRemoved(callback)`
    - `await callback()` - Called before tree is removed, may return a promise to delay removal.
        - This also delays resolution of the outer render/redraw call.
    - This is always scheduled for the current render pass only. During stateful component initialization, it's only scheduled for the first render pass, not subsequent ones. (Tip: using this on every call acts more like a fused `onbeforeremove` + `onremove`.)
    - This throws an error if this component is not currently rendering and the component view has already been initialized.
    - `callback` is called on the same tick, right before all changes have been committed to DOM so things like event handlers can be added.

- Schedule callback to run on component error: `info.whenCaught(callback)`
    - `await callback(e, stack, isFatal)` - Called with each error that propagates from children after this in the subtree as well as a component `stack` trace, may rethrow or return rejected promise to propagate
    - `isFatal` is whether the error was fatal (originated from any point other than `beforeRemove`) or not.
    - Errors caught include both errors in streams and errors and rejections caught from event handlers. It does *not* include errors thrown from the top-level component view invocation itself.
    - Caught errors are batched and scheduled to be reported on the next tick.
    - This exists mainly for error reporting, but can be used in other ways like with async network requests.
    - When an error propagates past a subtree, that subtree is synchronously removed with inner `done` callbacks invoked. If any of those throw, their errors are also added to the `errors` list.
    - Resolution searches back to the first child, then up to the parent, then back to its first child, and so on, until it finds such a hook.

- Create `capture` value: `info.createCapture(event?)`
    - `event` is an optional platform-specific object to initialize with (in case native events have such functionality built-in, like with the DOM).
    - This is part of the `info` object as 1. it may be more convenient to implement it natively and 2. it's platform-dependent.

- DOM renderer-specific:
    - Detected window: `info.window`
        - Useful in JSDOM
    - Detected document: `info.document`
        - Useful in JSDOM
    - Render root: `info.root`

### Design points for performance

You may be wondering why a few of these are defined on `info` and why this `info` object even exists. That's a valid question. Here's some answers:

- "On ready" callbacks are generally scheduled at the global level. In v2, this is done via reading and binding `oncreate`/`onupdate` callbacks, but with `info.whenReady(callback)`, you don't need to feature-detect at all - you can just do it directly whenever that method is invoked.
- "On remove" callbacks are generally scheduled as the component is visited. Reducing that to an inner array means no type checks are required, just an `array != null` or `array.length !== 0`.
- `info.ref` as a settable property trivializes that process, and it's just read whenever it's ready. There's literally no extra overhead involved.
- Using a single `info` object injected means we aren't doing polymorphic code accesses. The only polymorphic invocation involved is invoking the component.
- Setting keys via `info.setEnv("key", value)` is for similar reasons to `info.whenReady(...)` - the environment object can just be tracked globally, and `set` can just assign directly to it, creating it if necessary and setting a bit so it doesn't get recreated again (and to pre-allocate it on subsequent runs to avoid a branch prediction penalty).
- Stuff like `info.isInitial()` and `info.isParentMoving()` can just test a bit - they don't need to have a whole property dedicated to themselves.

> Also, in general, everything that *could* be a getter, setter, or proxy is a function, so those stuck developing against IE (and Edge's IE Mode) can shim as appropriate.

## Lifecycles

Lifecycles are much more streamlined, and there's fewer of them. It's bound to inline vnodes, so you can use them literally anywhere without them polluting element or component attributes. You capture refs just by capturing the return value of a component It consists of a hyperscript call you use to capture the parent vnode's ref + a few instance hooks:

- `callback` in `info.whenReady(callback)` is called with the ref after all changes or movement have been committed with this vnode, provided it wasn't removed.
    - Useful for DOM initialization and updating.

- `callback` in `info.whenRemoved(callback)` is called after all changes or movement have been committed with this vnode, provided it wasn't removed. It may return a promise to block removal. This is also called on parent error but not self or child error.

- `callback` in `info.whenCaught(callback)` is called on child error. The child errors caught and reported include both sync view errors, sync lifecycle errors propagated via `info.throw(e)`, sync event listener errors, and event listener rejections. This does *not* get called errors within lifecycle methods, only errors that occur in child components.

- `info.isInitial()` checks if this is the first render, for easier initialization.

- `info.isParentMoving()` checks if the parent ref is being moved (and not simply removed), primarily for knowing whether to save states for move transitions. It's on rare occasion useful elsewhere, but the diff algorithm can trivially pass this info down.

The syntax for them is similar to the syntax for hooks.

### Timings

This is another place where we break with other frameworks:

- The tree is diffed in a preorder traversal
- Components are rendered and scheduled in a postorder traversal

This happens to be better for performance and ergonomics, counterintuitively:

- Child components can set parent element and component attributes. This is what enables `transition` to work.
- Parent components receive the normalized and fully resolved children, with the rendered output of components and state callbacks in place of component vnodes and state vnodes.
- Certain DOM attributes, like `selectedIndex`, are set automatically by the children (in that case, the offset for the first child with a `selected` attribute), so to apply it correctly, you have to set it after you set the children. This is simpler than the workaround that HTML and other frameworks use, where they apply parent attributes before rendering children and just defer applying the offending attributes.
