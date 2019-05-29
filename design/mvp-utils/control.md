[*Up*](README.md)

# Control API

Formerly in v2, you could use a single-child fragment with a `key` to track a component's "identity" declaratively by linking it to a particular state. If you wanted to reinitialize it, you'd swap out the key to a new value when rendering, and it'd often be as simple as passing the key as a boolean and inverting it whenever you want to reinitialize the child.

Since keyed fragments, the main reason for the `key` attribute in the first place, now use a key selector function, the `key` attribute itself is now dropped. To replace that functionality, this built-in userland component, exposed under `mithril/control` and in the full bundle via `Mithril.Control` exists to reimplement it.

- `m(Control, {key?, ref?}, ...children)` - Define a reinitializable subtree
	- `key:` - An identity marker denoting the current key to declaratively reinitialize the tree whenever desired.
	- `ref: (reinit) => any` - Sends a `reinit` callback to manually and procedurally reinitialize the tree.

Under the hood, this uses a keyed fragment with a `by` that returns the `key` and a children function that returns the passed-in children.

### Why remove the magic `key` attribute?

It's part philosophical, part pragmatic. Philosophically, this lets me send attributes directly and unconditionally to components while breaking any possible dependency it could have on its conceptual identity. Also, this means the only magic attributes for components are `on:` and `children:`. Pragmatically, it's one less slot to store and one less blip of memory to try to manage, and it lets me optimize creation a bit better.
