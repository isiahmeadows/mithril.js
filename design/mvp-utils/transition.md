[*Up*](README.md)

# Transition API

This is exposed under `mithril/transition` and in the full bundle via `Mithril.Transition`.

- `m(Transition, {in, out, show, onin, onout, event}, children)` - Define a transitioned element
	- `in:` - Zero or more space-separated classes to toggle while transitioning inward.
	- `out:` - Zero or more space-separated classes to toggle while transitioning outward.
	- `show:` - Whether this should be considered shown. (This controls transition start.)
	- `onin:` - Called after the transition for `in:` completes, if `in:` is present.
	- `onout:` - Called after the transition for `out:` completes, if `out:` is present.
	- `event:` - The event name to listen for. By default, this watches for `"transitionend"`.
	- `children:` - The element to transition with. Note: this *must* be a single element.

Notes:

- `onin`/`onout` is only called for `in`/`out` finish when the relevant property exists and is `!= null`.
- Transitioned elements are cloned with appropriate attributes added and event handlers wrapped.
- When an element is hidden and immediately re-shown, the removal animation is awaited and the element fully removed before it's re-added.
- When an element is removed and immediately re-added and removed again, the removal animation is *not* restarted, nor is it re-added.

### Why?

1. Transitions are common enough they should have a story.
1. Transitions are not *hard* to get right, but they're not *obvious*, either.

This is part of making the simple easy. It's not computationally simple, but it's simple from a design perspective and it doesn't invade everything, so it should still be easy enough.
