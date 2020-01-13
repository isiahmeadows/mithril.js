[*Up*](README.md)

# Component API

Components are very simple and consistent. Lifecycle is easy to process, easy to understand as it's inherent with the model. State uses closures for simplicity. Here's what they look like:

```js
function Comp(attrs, info, env) {
    const state = info.state
    return view
}
```

- `attrs` is the current attributes, set to a frozen object. Event handlers are included for easier event delegation, but they're merged.
- `info` is the component info, necessary for basic tree reflection.
    - `info.state` is a simple property that allows stateful persistence.
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

- `attrs.onevent(value, capture?)` - Invokes `onevent(value, capture)` for each such listener and returns `true` if any of them invoked `capture.event()`.
    - If `capture` is not passed, one is made internally.
    - Note: the redraw is skipped if either it's not listened to or if all listeners call this.
- Event listeners are only defined if one event is listened to, but multiple event listeners are merged and single event listeners are normalized.

## Component info

The component info object (`info` below) contains all the necessary bits for components to manage themselves within a tree, including scheduling redraws and the like.

- Whether the component is active (and not yet removed): `test = info.isActive()`
    - `test` is `false` if the component was ever removed, `true` otherwise.

- Render to targeted node: `promiseToClose = info.render(target, init)`
    - This converts `target` to a root and renders `vnode = init(info)` accordingly, where `info` is a child info object. `init` is like a state vnode, but without the parent attributes.
    - This returns a promise that resolves once it's fully committed to the DOM, with a `promise = clear()` callback that clears the root, releases any relevant resources, and returns a promise that resolves once it's fully committed to the DOM. (This is always async, but the precise timing is an implementation detail.)
        - If no more roots exist, this removes the `data-mithril-root` attribute added above and sets `root._ir` to `undefined`.
    - The semantics depend on the renderer, and it can choose how to process `target` and `children`.
    - Inside the rendered subtree, `info.root` remains the same. It's *not* set to `target`.
    - Examples for the DOM renderer:
        - Set properties and events on `window`: `info.render(info.window, () => ({onfoo, ...}))`
            - Note: use with care. Note that since `window` is not an element, you must make sure that you only use writable attributes and event handlers.
        - Render attributes and children to `<html>`: `info.render(info.document.documentElement, () => ({...attrs}))`
            - This is useful for script and style inclusion as well as setting the title.
            - This is basically native support for what [React Helmet](https://github.com/nfl/react-helmet) provides for React. (For us, it's easy. Just render to a different node.)
        - Render children to `document.body`: `info.render(info.document.body, () => [...children])`
        - Render attributes and children to `<head>`: `info.render(info.document.head, () => [{...attrs}, ...children])`
            - This is useful for script and style inclusion as well as setting the title.
            - This is basically native support for what [React Helmet](https://github.com/nfl/react-helmet) provides for React. (For us, it's easy. Just render to a different node.)
        - Render children to `<body>`: `info.render(info.document.body).render(...children)`
            - You can set event handlers via attribute nodes, including ones like `mouseenter` and `mouseleave` that don't fire on `window`
            - You can set things like the `lang` attribute accordingly.
            - Extra nodes can be added for things like modals and alerts.
    - Note: when you invoke `info.render(target)`, this only clears resets attributes it tracks.
    - When called in `m.capture` or `info.whenRemoved`, it's *highly* recommended to await it before returning.
    - This makes stuff like userland modals trivial.
    - You can also usefully render to captured refs this way.

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
    - This may be called at any point in time, but only the latest value set before `info.whenReady` callbacks are invoked is used as the argument to them.
    - The initial `ref` is `undefined`, and previous refs are persisted. It can also be set to any value.
    - This is different from React's `useImperativeHandle` in that it lets you set the ref at any time.

- Set environment key: `info.set(key, value)`
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
    - `callback` is called on the same tick, right after all changes have been committed to DOM.

- DOM renderer-specific:
    - Detected window: `info.window`
        - Useful in JSDOM
    - Detected document: `info.document`
        - Useful in JSDOM
    - Render root: `info.root`

## Lifecycles

Lifecycles are much more streamlined, and there's fewer of them. It's bound to inline vnodes, so you can use them literally anywhere without them polluting element or component attributes. You capture refs just by capturing the return value of a component It consists of a hyperscript call you use to capture the parent vnode's ref + a few instance hooks:

- `callback` in `m.capture(callback)` is called with the ref after all changes or movement have been committed with this vnode, provided it wasn't removed.
    - Useful for DOM initialization and updating.

- `callback` in `info.whenRemoved(callback)` is called after all changes or movement have been committed with this vnode, provided it wasn't removed. It may return a promise to block removal. This is also called on parent error but not self or child error.

- `callback` in `m.catch(callback)` is called on child error. The child errors caught and reported include both sync view errors, sync lifecycle errors propagated via `info.throw(e)`, sync event listener errors, and event listener rejections. This does *not* get called errors within lifecycle methods, only errors that occur in child components.

- `info.isInitial()` checks if this is the first render, for easier initialization.

- `info.isParentMoving()` checks if the parent ref is being moved (and not simply removed), primarily for knowing whether to save states for move transitions. It's on rare occasion useful elsewhere, but the diff algorithm can trivially pass this info down.

The syntax for them is similar to the syntax for hooks.

### Timings

This is another place where we break with other frameworks:

- The tree is diffed in a preorder traversal
- Components are rendered and scheduled in a postorder traversal

This happens to be better for performance and ergonomics, counterintuitively:

- Child components can return attributes that affect parent components. This is what enables `transition` to work.
- Parent components receive the normalized and fully resolved children, with component instances in place of component vnodes and holes in place of attributes and lifecycle vnodes.
- Certain DOM attributes, like `selectedIndex`, are set automatically by the children (in that case, the offset for the first child with a `selected` attribute), so to apply it correctly, you have to set it after you set the children. This is simpler than the workaround that HTML and other frameworks use, where they apply parent attributes before rendering children and just defer applying the offending attributes.
