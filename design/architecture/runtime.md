[*Up*](./README.md)

# Runtime

On each frame with scheduled work, the runtime renders updates for all roots in sequence, in the order they were requested. Each render pass operates in three phases, continually looping until it performs all of the steps without a redraw requested:

1. Update all components and generate the operation queue.
2. Execute the operation queue while time permits and build the callback queue as applicable.
3. Invoke the callbacks in the callback queue.

### Queues

There are two queues mentioned above: the operation queue and the callback queue. The callback queue is a straightforward list of catch handler + callback handler pairs. The operation queue is a bit more complicated - it's an instruction sequence.

Each operation queue instruction contains the following fields:

- Operation ID

Here's all the possible operations:

- Remove element and advance to next element

### 1. Update all components and generate the operation queue

This pass does just as it sounds: it updates all components, and it generates an operation queue while it does that.

> Note re: keys: https://github.com/MithrilJS/mithril.js/issues/2618

TODO: three phases:

1. Component update + stack op queue
2. Stack queue execute
3. Invoke callbacks and if redraw requested, loop back to 1
