[*Up*](README.md)

# Component DSL

The component DSL is a powerful embedded DSL-based alternative to the [standard component library API](components.md), one that is very flexible, but is somewhat opinionated out of the box. It works similarly to React Hooks, but is designed as an embedded language rather than a simple library. All its various primitives, like `component`, `slot`, and `hasChanged`, are exported from `mithril/component`.

> If you're not as technical, "DSL" in this context stands for "domain-specific language". And in this case, it's a domain-specific language embedded in JavaScript. So while you do have all of JavaScript at your side ready to do anything you want, embedded DSLs like this one do have a fair number of rules you have to follow for them to work, and they do sometimes also have to replace primitive constructs like functions and logical AND to work as they're supposed to.

There's a handful of helpers [here](../examples/helpers) based on [some of these hooks](https://usehooks.com/), in case you want to know what it could look like in practice. The `dark-mode-full` has them all in one file, and the rest have them split into individual files.

## Basic syntax

Here's how you define a component:

```js
let Comp = component("Comp", (attrs) => {
    return view
})
```

- `attrs` is the same `attrs` object passed as the first argument to [stateless components defined using the component API](components.md).
- `view` is the child vnode subtree to render.

The component definition itself is stateless and does *not* include mutable state of its own, so it's perfectly fine to pass it to `m.state` like in `m.state(component(() => whatever(data)))`

## State

Within the component, here's how you define state variables:

```js
// Either of these can be named whatever you want - you could even do something
// like `let [foo, bar] = slot(0)` - it doesn't matter.
let [counter, setCounter] = slot(0)
```

And you can update it like this:

```js
function increment() {
    setCounter(counter + 1)
}
```

That itself returns the result of `info.redraw()`, so you can await its resulting promise. You can feel free to do things like `setCounter(counter + 1).then(doSomethingInteresting)` without issue.

If you ever want a simple mutable state cell that doesn't schedule a redraw on update, you use this:

```js
let counter = ref(0)
```

It sets the variable to a simple reference with a `.current` property, one you can freely modify like in this example here:

```js
function increment() {
    counter.current += 1
}
```

If you want to get a little lazier, you can do something like this:

```js
let [counter, updateCounter] = lazy(() => 0)
```

In this case, you can update it like this:

```js
function increment() {
    updateCounter(c => c + 1)
}
```

This might seem completely unnecessary on its face given `slot` and `ref`, but it can be profoundly useful with larger objects if you only want to update a couple properties on them, and in addition, updates are buffered and can be individually async. So you can do crazy stuff like this in them without issue:

```js
function recalcStatistics(x, y) {
    updateList(async nums => {
        let result = await computeStatistics(nums)
        renderLine(result.regressionLine)
        return result.nums
    })
}
```

If all you want is a simple memoized state slot that lasts the entire duration of the component, you can just use this:

```js
let value = memo(() => ({foo: 1}))
```

Since it's a very common need for things like comparisons, you can use this declaration to get the value of an object or a variable from the last render:

```js
let lastFoo = usePrevious(attrs.foo)
```

If it's the first render, the variable is set to `undefined`, but this of course can be tweaked by passing an initial value for the second parameter.

```js
let lastLength = usePrevious(values.length, 0)
```

You can scope variables using blocks if you wish:

```js
// Not a problem
{
    let [state, setState] = slot(0)
}

{
    let [state, setState] = slot(1)
}
```

However, names *must* be unique within the same block, or the underlying JS engine will complain:

```js
// Definitely a showstopper here
let [state, setState] = slot(0)

let [state, setState] = slot(1)
```

Sometimes, it takes more than just a simple value to model something - you may want to have a value and update it with actions rather than just set it directly. It's an uncommon need, but that's what `useReducer` is for.

```js
let [count, dispatch] = useReducer(() => 0, action => {
    switch (action) {
        case "increment": return count + 1
        case "decrement": return count - 1
        default: throw new Error(`Unknown action: ${action}`)
    }
})

return m("div.counter",
    m("button", "▲", {onclick: () => dispatch("increment")}),
    m("span", "Count: ", count)
    m("button", "▼", {onclick: () => dispatch("decrement")})
)
```

`dispatch` in the above works a lot like `setState`, except it just sends an action and not the new value. Note that the reducer body (the second part) is called immediately on dispatch, and that the redraw is only performed if this succeeds without throwing. The initializer (first part) runs synchronously on first run.

## Non-state variables

Non-state variables are standard JS variables, and these persist only for the current render pass - they cease to exist without it.

```js
let value = 1
```

## Async data

You can request async data and access it with `use`:

```js
// `signal` is an `AbortSignal`
let result = use(async signal => {
    // ...
})

// The current resolution state, either `"pending"`, `"ready"`, or `"error"`.
let state = result.state()

// `undefined` if pending, the resolution value if resolved, or the rejection
// value if rejected.
let value = result.value()

// Sugar for the following code:
// ```js
// switch (result.state()) {
// case "pending": return foo()
// case "ready": return bar(result.value())
// case "error": return baz(result.value())
// }
// ```
result.match({
    // You can omit any of these, and it's equivalent to throwing the error if
    // the current resolution state is `"error"`, returning `undefined` if the
    // current resolution state is anything else.
    pending: () => foo(),
    complete: value => bar(value),
    error: err => baz(err),
})
```

Whenever the returned promise resolves or rejects, it not only sets the value, but it also schedules a redraw, so your view gets updated with the proper values automatically. The initializer's call is deferred, in case it's sufficiently expensive to perform, so it doesn't interfere with rendering performance.

No support for observables or the like is included *for now*, but this could change in the future if/when [the observable proposal](https://github.com/tc39/proposal-observable) or other similar language proposals like [emitters](https://github.com/tc39/proposal-emitter) gain traction.

## Comparisons

Comparisons are pretty simple and work almost exactly like they would in normal JS. Equality and so on all work. There are two exceptions, though: `a && b && ...` becomes `and(a, b, ...)` and `a || b || ...` becomes `or(a, b, ...)`. These do *not* short-circuit their arguments (it's a function call in JS), and this is necessary so the state for things like `usePrevious` is reached consistently on every render.

For a very common case, you often want to do things like this:

```js
// Reinitialize if an ID changed
if (attrs.id !== usePrevious(attrs.id)) {
    reinitialize()
}

// Shortcut updating the view if the attributes are the same
if (and(
    attrs.foo === usePrevious(attrs.foo),
    attrs.bar === usePrevious(attrs.bar),
    attrs.onclick === usePrevious(attrs.onclick)
)) {
    return m.RETAIN
}
```

That's where `hasChanged` comes in.

```js
// Reinitialize if an ID changed
if (hasChanged(attrs.id)) {
    reinitialize()
}

// Shortcut updating the view if the attributes are the same
if (!hasChanged(attrs)) return m.RETAIN
```

This seems like magic, especially that second bit, but it's not. `hasChanged(a, b, ...)` returns `true` if any of its values change. (Note: *always* pass the same number of arguments each time.) If you need to compare specially, you can use `hasChangedBy(value, (a, b) => cond)`, and `hasChanged(a)` works the same as `hasChangedBy(a, isEqual)`, comparing for structural equality. As for that condition, it can be any function that can accept the old and new values and spit out a boolean.

Do *not* do things like `hasChanged(...values.map(func))` - instead, remove the spread and do things like `hasChanged(values.map(func))` so it will diff as an array. Stuff like that is almost never what you want to do, since if `values` gets a new value or loses a value, you will almost inevitably run into major bugs that would be a massive pain to troubleshoot.

`mithril/component` exports two different functions of its own, made for you to pass to `by`, but you can also use them wherever else you want to.

- `isEqual(a, b, opts: {tolerance = 1e-8})` - This does a deep structural equality match. This is the default for `hasChanged`.
    - The tolerance is for floating point comparisons, to see if within their relative scales, they're sufficiently close to equal to count as conceptually "equal".
    - The default tolerance here was figured out from some past trial and error by me (@isiahmeadows) and is fairly arbitrary.
- `isIdentical(a, b)` - This performs [SameValueZero(`a`, `b`) as per the ECMAScript spec](https://tc39.es/ecma262/#sec-samevaluezero) (as used in `array.includes(item)`, map keys, and so on) and returns the result. This is basically the same as `a === b`, except `NaN`s are considered equal.

For `isEqual(a, b, {tolerance})`, there's several rules on how it works:

- If `a` and `b` are both numbers, this compares them [as per this algorithm](https://github.com/isiahmeadows/clean-assert/blob/master/lib/comparison.js#L38-L80).
- If a method [`fantasy-land/equals`](https://github.com/fantasyland/fantasy-land#setoid) exists on `a`, it's called via `a["fantasy-land/equals"](b)` and the result is coerced to a boolean and returned. This is only called for objects.
- If a method `equals` exists on `a`, it's called via `a.equals(b)` and the result is coerced to a boolean and returned.
- Otherwise, this follows the same general rules of [my strict matching algorithm for Clean Assert](http://github.com/isiahmeadows/clean-assert/blob/0233c2c3e15e66f20f35694c7b3c5eee93420df7/docs/utility.md#how-does-the-structural-matching-work). (Obviously, the same rules would apply to the recursive checks, too.)

## Conditionals

Conditions require their own story, and of course this does provide one. They're pretty flexible and can account for virtually all needs.

First, the basics: you can use standard JS flow control like `if` and `for` with little fuss.

```js
if (condition) {
    foo()
} else {
    bar()
}

// Works the same as this:
//
// ```js
// let expr
// if (x) expr = foo()
// else expr = bar()
// ```
let expr = x ? foo() : bar()

for (let key of coll) {
    doSomething()
}
```

However, there's a catch: you can't declare state with things, or very bad things could happen if you do.

(Note: the browser will still try to execute it anyways - it doesn't know about the DSL syntax!)

```js
// Wrong: if `condition` changes from `true` on the first run to `false` on the
// second, `bar` will be set to `"foo"` due to the way the DSL is implemented,
// which is almost certainly *not* what you want.
//
// It's also syntactically invalid for the DSL.
if (condition) {
    let [foo, setFoo] = slot("foo")
    // ...
} else {
    let [bar, setBar] = slot({bar: true})
    // ...
}
```

You can handle the above example this way with `when`, which handles state branching accordingly and otherwise works *just like* `if`/`else`:

```js
// if (condition) { ... }
when(condition, () => {
    // ...
})

// if (condition) { ... } else { ... }
// With the previous example
when(condition, {
    then() {
        let [foo, setFoo] = slot("foo")
        // ...
    },
    else() {
        let [bar, setBar] = slot({bar: true})
        // ...
    },
})
```

The block is called synchronously, so keep that in mind. You can also use all the other usual stuff in it without issue, and it does correctly track shared state within each condition's branch. Note that if the condition changes, the state is removed and removal hooks are fired accordingly (which *can* block component DOM removal!).

Oh, and one other thing: this returns the return value of the block that runs, so you can do things like this:

```js
let transformed = when(condition, {
    then() {
        let [foo, setFoo] = slot("foo")
        // ...
        return transformFoo
    },
    else() {
        let [bar, setBar] = slot({bar: true})
        // ...
        return transformBar
    },
})
```

Note: if you need to manually reset a component, you can use `let [isToggled, toggle] = useToggle()` + `guard(isToggled, () => ...)` and just call `toggle()` whenever you need to toggle something.

## Render state

You can check if this is the current render via calling `isInitial()` in the body. If you want to set the ref captured via `m.capture(ref)`, you can use `setRef(ref)`. For more advanced uses, like `info.render(target, vnode)` or `info.throw(error)`, you can get the [`info` object](components.md#component-info) itself via `info = useInfo()`.

You can also get keys from the [`env` value passed](components.md) via `let {key} = useEnv()` and set them via `setEnv("key", value)`, for things like routing.

And for the common case of just listening to events, you can use `usePortal(target, ...children)`, which just renders `...children` to `target` using `info.render` and handling its lifecycle appropriately.

## Lifecycle

When you need to schedule a callback to modify the DOM, you can just use `whenReady(func)` somewhere in your tree. It's perfectly okay to store the element directly in a variable - it's called on every render.

```js
// This is a bit of a contrived example, but you can imagine how it'd play out
// in more real-world examples.
return m("div.container", ...otherChildren, component(() => {
    let container
    whenReady((elem) => {
        container = elem
        container.height = calculateHeight()
    })
}))
```

If you just need to do work after the component executes (suppose it's an expensive calculation), you can use `whenReady`. The callback can itself return a promise, in which errors are handled appropriately. (Note: errors here are *fatal* and result in the removal of the component.)

```js
whenReady(async () => {
    await doSomethingExpensive()
})
```

When you need to schedule a callback to run on removal, you can do that with `whenRemoved`. Since this isn't DOM-specific, this is a global hook.

```js
whenRemoved(() => stream.close())
```

You can even return a promise to block removal. This is useful for waiting for transitions and such. If this errors, the component propagates it as usual (but as a non-fatal error).

```js
let elementRef

whenRemoved(() => new Promise(resolve => {
    function listener(e) {
        e.stopPropagation()
        elementRef.current.removeEventListener("transitionend", listener, false)
        resolve()
    }
    elementRef.current.addEventListener("transitionend", listener, false)
}))
```

When you need to react to changes within the data model itself and conditionally recreate state, you can use `guard` which after first run reinitializes the body each time `cond` returns `true`. `signal` here is what you get from [`info.signal(init)`](signal.md) (an `AbortSignal` when rendering to the DOM), and it's aborted whenever the component is removed or after the block reinitializes. It always returns its result for simplicity and ease of use.

```js
let result = guard(cond, signal => {
    // ...
    return result
})
```

It composes very well with other things, like `use` and `bind`, and you can do some mad science things like auto-requesting customers based on ID.

```js
let CustomerPage = component("CustomerPage", ({id}) => {
    let result = guard(hasChanged(id), () => {
        return use(signal => request(p("/api/customer/:id", {id}), {signal}))
    })
    return result.match({
        pending: () => m(Spinner),
        complete: ({customer}) => m("div.customer",
            m("div.customer-id", "Customer ID: ", customer.id),
            m("div.customer-name", "Name: ", customer.name),
            m("div.customer-email", "Email: ", customer.email),
        ),
        error: e => m(LoadError, {error: e}),
    })
})
```

## Dependencies

The meat of this DSL is designed around guards and conditions, but sometimes, it's easier to think in terms of dependencies and relations, and it's often simpler as well.

For `memo` and `use`, you can specify an initial dependency (or array of them, works the same), and it recomputes only when its dependency changes value.

```js
// `memo` with dependencies
const value = memo(dependency, () => value)

// Equivalent to:
const value = guard(hasChanged(dependency), () => memo(() => value))

// `use` with dependencies
const request = use(dependency, () => fetchResource())

// Equivalent to:
const request = guard(hasChanged(dependency), () => use(() => fetchResource()))
```

Because it's so convenient, each are passed the dependency in question also as the first parameter, so you don't have to specify it explicitly every time.

There's also `useEffect`, which sugars over `guard` and `whenRemoved` similarly.

```js
useEffect(dependency, () => {
    const state = setupState()

    return () => {
        cleanup()
    }
})

// Equivalent to:
guard(hasChanged(dependency), () => {
    const removeCallback = memo(() => {
        setupState()
        return () => {
            cleanup()
        }
    })

    whenRemoved(removeCallback)
})
```

## Idioms

Custom hooks should follow the following conventions:

- If an inner value is returned or it's an external resource being "used", it should be named `useFoo`.
- If it's an immediate condition, it should be named `hasFoo` or `isFoo`.
- If it's used to react to something (lifecycle, a change, or similar), it should be named `whenFoo` and accept a simple callback.

In addition, hooks *should not* attempt to track dependencies. They should only operate based on their lifecycle, as users can manage dependencies and control updates as necessary via `guard` and `when`.

## Implementation

Believe it or not, this isn't actually all that magical, and the embedded DSL itself could be (and is) implemented as a library. The core primitives here are `ref`, `whenRemoved`, `useEnv`, and `useInfo`, none of them that complicated, and literally everything else can be implemented in terms of just those few primitives.

Believe it or not, most of the operations here can be specified in terms of other operations, and the only real primitives are `ref`/`memo`/`slot` (take your pick), `whenRemoved`, `useEnv`, `useInfo`, `component`, and `when`/`guard` (take your pick). Here's the full API implemented in terms of these, to show how they all relate.

> Note: the real implementation is far more optimized than this - for one, it doesn't allocate a close function at top-level but instead more delegates directly to `info`. Also, for simplicity, I chose `ref` and `guard` here for the main core primitives.

```js
/*************************************/
/*                                   */
/*   C o r e   p r i m i t i v e s   */
/*                                   */
/*************************************/

let _currentState

function _getState() {
    if (_currentState == null) {
        throw new TypeError("This must be called inside a component context.")
    }
    return _currentState
}

function _initState(info) {
    let refs = [], removes

    return {
        run: (env, block) => {
            let prev = _currentState
            _currentState = {info, index: 0, env, refs, removes: removes = []}
            try {
                block()
            } finally {
                _currentState = prev
            }
        },

        // Wait for all to settle - doesn't matter what the result is. If
        // they all error out during reporting, then complain.
        close: () => Promise.all(removes.map(async remove => {
            try { await remove() } catch (e) { info.throw(e, false) }
        })),
    }
}

function whenRemoved(callback) {
    _getState().removes.push(callback)
}

function ref(initialValue) {
    let state = _getState()
    let index = state.index++
    if (!state.info.isInitial()) return state.refs[index]
    let value = {current: initialValue}
    state.refs.push(value)
    return value
}

function useInfo() {
    return _getState().info
}

function useEnv() {
    return _getState().env
}

function component(name, body) {
    function Comp(attrs, info, env) {
        let {run, close} = info.state != null
            ? info.state
            : (info.state = _initState(info))
        info.whenRemoved(close)
        return run(() => body(attrs), env)
    }
    return Object.defineProperty(Comp, "name", {value: name})
}

function guard(reinit, body) {
    let info = useInfo()
    let env = useEnv()
    let state = ref()
    let closed = ref([]).current

    reinit = Boolean(reinit) || info.isInitial()

    let prevState = state.current
    if (reinit) state.current = _initState(info)

    whenRemoved(() => state.current.close()))
    for (const promise of closed) whenRemoved(() => promise)

    try {
        return state.current.run(block, env)
    } finally {
        if (reinit) {
            let promise = prevState.close()

            // Add it, then remove it once it resolves.
            closed.push(promise)
            whenRemoved(() => promise)
            promise.finally(() => {
                closed.splice(closed.indexOf(promise), 1)
            })
        }
    }
}

/*******************************************/
/*                                         */
/*   D e r i v e d   o p e r a t i o n s   */
/*                                         */
/*******************************************/

function isInitial() {
    return useInfo().isInitial()
}

function whenReady(callback) {
    useInfo().whenReady(callback)
}

function setEnv(key, value) {
    useInfo().set(key, value)
}

function useReducer(init, reducer) {
    let cell = ref()

    if (isInitial()) cell.current = init()

    return [cell.current, action => {
        cell.current = reducer(cell.current, action)
        return info.redraw()
    }]
}

function slot(value) {
    return useReducer(() => value, (prev, next) => next)
}

function lazy(init) {
    return useReducer(init, (prev, func) => func(prev))
}

function memo(init) {
    return lazy(init)[0]
}

function useToggle() {
    let info = useInfo()
    let cell = ref(false)
    let prev = cell.current
    cell.current = false
    return [prev, () => {
        cell.current = true
        return info.redraw()
    }]
}

function usePrevious(value, initial) {
    let cell = ref()
    let previous = isInitial() ? initial : cell.current
    cell.current = value
    return previous
}

function use(init) {
    let [[state, value], setState] = slot(["pending"])
    let [ctrl, promise] = memo(() => {
        let ctrl = new AbortController()
        let promise = Promise.resolve(ctrl.signal).then(init).then(
            value => { setState(["ready", value]) },
            error => { setState(["error", e]) }
        )
        return [ctrl, promise]
    })

    whenRemoved(() => { ctrl.abort() })

    return {
        state: () => state,
        value: () => value,
        match: params => params[state](value),
    }
}

function and(...args) {
    for (let arg of args) {
        if (!arg) return false
    }
    return true
}

function or(...args) {
    for (let arg of args) {
        if (arg) return true
    }
    return false
}

function isEqual(a, b, {tolerance = 1e-8} = {}) {
    // Implementation omitted for brevity
}

function isIdentical(a, b) {
    return a === b || a !== a && b !== b
}

function hasChanged(...values) {
    return or(...values.map(v => hasChangedBy(v, isEqual)))
}

function hasChangedBy(value, comparator) {
    let prev = usePrevious(value)
    return isInitial() || comparator(prev, value)
}

function when(cond, opts) {
    cond = Boolean(cond)
    let block

    if (typeof opts === "function") {
        if (cond) block = opts
    } else {
        block = cond ? opts.then : opts.else
    }

    let prevCond = usePrevious(cond)

    return guard(cond !== prevCond, signal =>
        typeof block === "function" ? block(signal) : undefined
    })
}

function usePortal(target, ...children) {
    return guard(hasChanged(target), () => {
        let info = useInfo()
        let child = ref()
        let handle = ref()
        let promiseToClose = memo(() => info.render(target, (info) => {
            handle.current = info
            return child.current
        }))
        whenRemoved(() => promiseToClose.then((close) => close()))
        child.current = children
        if (handle.current != null) handle.current.redraw()
    })
}

const _p = Promise.resolve()

function defer(func) {
    const info = useInfo()
    p.then(() => func()).catch((e) => {
        info.throw(e, true)
    })
}
```
