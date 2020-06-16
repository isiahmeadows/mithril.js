[*Up*](./README.md)

# Lazy loading

This is exposed under `mithril/lazy`.

- `lazy(init, key)` - Create a component wrapping a lazy-loaded resource
    - `module = await init()` - Load the component.
    - `key` is the key to read from the module. If omitted, it's `default`.
    - It is not possible to abort the load, as it's cached globally for that instance.
    - In general, 99% of uses are going to just be `const Comp = lazy(() => import("./some-module"))`.
    - Fallbacks aren't supported as you could just use [`Use`](use.md).

### Why?

1. It's one of the two most common use cases for [`Use`](use.md) by far, the other being the "read" part of CRUD apps (which almost always want some sort of loading indicator, so they will want this).

It's common enough that even React, which tends to avoid lumping this kind of thing in core, [is actually working to implement this exact feature with a few small design differences](https://reactjs.org/docs/code-splitting.html).
