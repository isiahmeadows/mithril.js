# Notes

Just some general notes about the model.

- The component model is very much like a `(s, a) -> (s, b)` function where `s` is your state, `a` is your attributes + context, and `b` is your view. There's just a lot of sugar to hide this, since JS doesn't have an easy way to just map over the right side of a tuple like Haskell's `second`.
