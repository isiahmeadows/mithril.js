[*Up*](README.md)

# Component API

Components are very simple and consistent. Lifecycle is easy to process, easy to understand as it's inherent with the model. State uses closures for maximum safety and performance. Here's what they look like:

```js
// Stateful
function Comp(ctrl, initialAttrs, initialContext) {
    return (attrs, context) => {
        return child
    }
}

// Stateless
function Comp(ctrl, attrs, context) {
    return child
}
```

- `ctrl` is the component controller, necessary for events
- `initialAttrs` are the initial attributes. These are also passed as `attrs` on the first view call
- `initialContext` are the initial context. These are also passed as `context` on the first view call
- `attrs` is the current attributes, set to a frozen object. Event handlers are included for easier event delegation, but they're merged.
- `context` is the current context, set to a frozen object.
- `child` is the child vnode subtree to render

This is inherently *very* fast, as it doesn't have to worry about virtual dispatch, property access, or anything else. Engines already implement functions as basically `{code, closure}` pairs, and they just do a computed call/jump to call into the closure, something very fast. It very much *doesn't* have the overhead methods have. Lifecycle methods are handled as part of the hooks, to avoid unnecessary external types from entering components and creating unhelpful polymorphism. And of course, the only major component-level memory allocation is in the closure itself and in the creation of the intermediate vnode tree, a place where engines and the framework can optimize it to oblivion.

And of course, `oninit`, `onbeforeupdate`, and `view` are all merged into this model and are otherwise generally unnecessary.

- `oninit` → first call, `i.isInit() === true`
- `view` → any call, return value of view function
- `onbeforeupdate` → invoke generated `comparator` + return `i.retain()`

For convenience and consistency, `attrs.children` is set to a resolved children array, where attribute children and refs are resolved to holes. (They've already been addressed.)

## Event handlers

The component receives event handlers a little differently. Specifically:

- `attrs.on.event(value, capture?)` - Invokes `on.event(value, capture)` for each such listener and returns `true` if any of them invoked `capture.event()`.
    - If `capture` is not passed, one is made internally.
    - Note: the redraw is skipped if either it's not listened to or if all listeners call this.
- Event listeners are only defined if one event is listened to, but multiple event listeners are merged and single event listeners are normalized.

## Component controller

The component controller (`ctrl` below) contains everything necessary for components to hook into the lifecycle and outer system.

- Throw error: `ctrl.throw(value)`
    - This triggers the usual exception handling mechanism, the same one used for event listeners and synchronous view errors.

- Recover from error: `remove = ctrl.catch((errors) => ignored)`
    - Invoke `remove()` to remove this handler.
    - If an error is caught from this component's children, the function is called with a list of `errors` and its `newChild` is rendered.
    - Errors caught include both errors in streams and errors and rejections caught from event handlers. It does *not* include errors thrown from the function itself.
    - Caught errors are batched and scheduled to be reported on the next tick.
    - This exists mainly for error reporting, but can be used in other ways like with async network requests.
    - When an error propagates past a subtree, that subtree is synchronously removed with inner `done` callbacks invoked. If any of those throw, their errors are also added to the `errors` list.

- Invoke redraw: `promise = ctrl.redraw()`
    - Returns a promise that resolves once the redraw is fully committed.
    - This only redraws the current root, not all redraw points.

- Is static: `ctrl.isStatic()`
    - This is set based on the renderer. For the DOM renderer, this returns `false`, but for the static renderer, it returns `true`.

- Is parent moving: `ctrl.isParentMoving()`
    - This throws an error if this component is not currently rendering and the component view has already been initialized.
    - This allows transitions to work without having to know about their surrounding context.
    - It's virtually zero-cost to implement, anyways, so it's an easy, obvious thing to add.

- Is initial render: `ctrl.isInit()`
    - This throws an error if this component is not currently rendering and the component view has already been initialized.
    - This is technically discernible in userland, but it's provided here for convenience. It's effectively zero-cost to implement, anyways.

- Render type: `ctrl.renderType()`
    - This gets the render type. For the DOM renderer, it returns `"dom"`, and for the static renderer, it returns `"static"`. Other renderers are encouraged to return their own values for these.

- Schedule removal callback: `remove = ctrl.beforeRemove(callback)`
    - `remove()` - Remove the scheduled callback.
    - This is always scheduled for the current render pass. During stateful component initialization, it's only scheduled for the first render pass, not subsequent ones. (Tip: don't use this during stateful component initialization. It doesn't do what you think it will.)
    - This throws an error if this component is not currently rendering and the component view has already been initialized.
    - `callback` is called right before the nodes themselves are removed, and it may return a promise to delay removal.

- Schedule for after commit: `remove = ctrl.afterCommit(callback)`
    - `remove()` - Remove the scheduled callback.
    - This is always scheduled for the current render pass. During stateful component initialization, it's only scheduled for the first render pass, not subsequent ones. (Tip: using this during component initialization acts more like `oncreate`, not a completely fused `oncreate` + `onupdate`.)
    - This throws an error if this component is not currently rendering and the component view has already been initialized.
    - `callback` is called on the same tick, right after all changes have been committed to DOM.

- Set context: `ctrl.setContext(keys)`
    - This throws an error if this component is not currently rendering and the component view has already been initialized.
    - `keys` is a key/value map of context keys to copy over. Own, enumerable symbols are copied over similarly using `Object.getOwnPropertySymbols` + `Object.prototype.propertyIsEnumerable`.
    - If a previous key existed, this overwrites that key.
    - During render, this basically does `context = Object.freeze(Object.create(context, Object.getOwnPropertyDescriptors(keys)))` and renders the children with this new context, except it filters out non-enumerable keys.
    - This does not affect the `i.context` initially received, just those of future children rendered.

- Set component ref: `ctrl.setRef(ref)`
    - This throws an error if this component is not currently rendering and the component view has already been initialized.
    - `ref` can be any value.
    - This ignores any child ref.
    - Previous refs are persisted.
    - The default ref is the one readable from `m.capture(ref)`.
    - This is different from React's `useImperativeHandle` in that the ref is part of the tree, not part of the component. It also lets you return refs from helper functions, which is sometimes useful.
    - Note that this cannot be used except during synchronous rendering.

- Run async action: `result = ctrl.await(async (signal, arg) => result)`
    - This throws an error if this component is not currently rendering and the component view has already been initialized.
    - `result.state` is the current resolution state, either `"pending"`, `"ready"`, or `"error"`
    - `result.value` is `undefined` if pending, the resolution value if resolved, or the rejection value if rejected.
    - `result.fetch(arg, compare = sameValueZero)` initiates the fetch. On first run or if `compare(prev, arg)` returns falsy, it re-fetches and cancels the previous fetch (in that order, if you want to detect it); otherwise, it does nothing.
    - This implicitly schedules a redraw on completion.
    - In the DOM renderer, it's basically sugar for `ctrl.afterRemove(() => abortController.cancel(), true)` + `ctrl.redraw()` with promises and an abort signal. If `AbortController` isn't supported, it's shimmed with a simple `addEventListener` + `removeEventListener` + `onabort`, enough to support basic usage + `m.request`. (As in, very loosely and not remotely close to spec.) The callback is removed after the promise resolves.
    - In the static renderer, this is also a primitive that schedules a redraw after the promise resolves. This is awaited recursively until no more `ctrl.await` calls are pending. It returns a dummy signal with no-ops for `addEventListener` + `removeEventListener` and it doesn't call `onabort`.
    - On many other platforms, it's more appropriate to return something else entirely. For instance, a renderer running on .NET natively should provide a similar implementation exposing a genuine `System.Threading.CancellationToken` object or a wrapper thereof. Also, Java cancellation doesn't directly notify, so you'd have to create a pretty heavy wrapper for it. You most certainly *should* document the cancel token type if your renderer doesn't provide the same minimal API the DOM renderer does.

- Connect to stream: `result = ctrl.connect(arg => stream)`
    - This throws an error if this component is not currently rendering and the component view has already been initialized.
    - `result.state` is the current resolution state, either `"pending"`, `"ready"`, or `"error"`
    - `result.value` is `undefined` if pending, the resolution value if resolved, or the rejection value if rejected.
    - `result.fetch(arg, compare = sameValueZero)` initiates the fetch. On first run or if `compare(prev, arg)` returns falsy, it recreates the stream and closes the current one (in that order, if you want to detect it); otherwise, it does nothing.
    - This implicitly schedules a redraw on each emit as well as on completion.
    - In the DOM renderer, it's basically sugar for `ctrl.afterRemove(close, true)` + `ctrl.redraw()`, where `close` is the stream close callback.
    - In the static renderer, this is also a primitive that schedules a redraw after the stream first emits a value. This is awaited recursively until no more `ctrl.connect` calls are pending.

- DOM renderer-specific:
    - Detected window: `ctrl.window`
        - Useful in JSDOM
    - Detected document: `ctrl.document`
        - Useful in JSDOM

## Lifecycles

Lifecycles are much more streamlined, and there's fewer of them. It's bound to inline vnodes, so you can use them literally anywhere without them polluting element or component attributes. You capture refs just by capturing the return value of a component It consists of a hyperscript call you use to capture the parent vnode's ref + a few instance hooks:

- `m.capture(ref)` sets the value of `ref` to the parent component. `ref` must be an actual `Ref` instance and is assumed to be such.

- `callback` in `ctrl.afterCommit(callback, persistent?)` is called after all changes or movement have been committed with this vnode, provided it wasn't removed.
    - Useful for DOM initialization and updating.

- `callback` in `ctrl.beforeRemove(callback, persistent?)` is called after all changes or movement have been committed with this vnode, provided it wasn't removed. It may return a promise to block removal. This is also called on parent error but not self or child error.

- `callback` in `ctrl.catch(callback)` is called on child error. The child errors caught and reported include both sync view errors, sync lifecycle errors (including `ctrl.connect` close and `ctrl.async` abort), sync event listener errors, and event listener rejections. This does *not* get called on `ctrl.await` or `ctrl.connect` sync errors, nor does it get called on rejections caught by `ctrl.await` or `error` emits received by `ctrl.connect`.

- `ctrl.isInit()` checks if this is the first render, for easier initialization.

- `ctrl.isParentMoving()` checks if the parent ref is being moved (and not simply removed), primarily for knowing whether to save states for move transitions. It's on rare occasion useful elsewhere, but the diff algorithm can trivially pass this info down.

The syntax for them is similar to the syntax for hooks.

### Timings

This is another place where we break with other frameworks:

- The tree is diffed in a preorder traversal
- Components are rendered and scheduled in a postorder traversal

This happens to be better for performance and ergonomics, counterintuitively:

- Child components can return attributes that affect parent components.
- Parent components receive the normalized and fully resolved children, with component instances in place of component vnodes and holes in place of attributes and lifecycle vnodes.
- Certain DOM attributes, like `selectedIndex`, are set automatically by the children (in that case, the offset for the first child with a `selected` attribute), so to apply it correctly, you have to set it after you set the children. This is simpler than the workaround that HTML and other frameworks use, where they apply parent attributes before rendering children and just defer applying the offending attributes.
