[*Up*](./README.md)

# Bitwise operations

Throughout this repo, particularly in the main source, there's a lot of bitwise operations used. These mainly come down to a few simple reasons:

- I want to be able to compare vnodes in various ways in as few operations as practically possible.
- I want to be able to compare several states and features in parallel.
- I want to keep memory down by packing all the extra type info into a single integer.

Here's a quick explainer of how it works.

## Bit representation

Bitwise operations in JavaScript are performed based on the 32-bit integer representation of the number. In addition, it provides three literal types that help you define integers concisely by bits:

|  Type  | Bits/digit |    Example   |
|:------:|:----------:|:------------:|
| Binary |     1      | `0b00011100` |
| Octal  |     3      |    `0o034`   |
| Hex    |     4      |    `0x1C`    |

Each digit defines the bits starting from the least significant bit. For example, `0b0001` has only the lowest bit set and is equivalent to decimal `1`.

Here's a quick overview of how each of these translate into bit patterns:

**Binary:**

| Digit | Bits | Decimal |
|:-----:|:----:|:-------:|
|  `0`  |  `0` |   `0`   |
|  `1`  |  `1` |   `1`   |

**Octal:**

| Digit |  Bits | Decimal |
|:-----:|:-----:|:-------:|
|  `0`  | `000` |   `0`   |
|  `1`  | `001` |   `1`   |
|  `2`  | `010` |   `2`   |
|  `3`  | `011` |   `3`   |
|  `4`  | `100` |   `4`   |
|  `5`  | `101` |   `5`   |
|  `6`  | `110` |   `6`   |
|  `7`  | `111` |   `7`   |

**Hex:**

| Digit |  Bits  | Decimal |
|:-----:|:------:|:-------:|
|  `0`  | `0000` |   `0`   |
|  `1`  | `0001` |   `1`   |
|  `2`  | `0010` |   `2`   |
|  `3`  | `0011` |   `3`   |
|  `4`  | `0100` |   `4`   |
|  `5`  | `0101` |   `5`   |
|  `6`  | `0110` |   `6`   |
|  `7`  | `0111` |   `7`   |
|  `8`  | `1000` |   `8`   |
|  `9`  | `1001` |   `9`   |
|  `A`  | `1010` |  `10`   |
|  `B`  | `1011` |  `11`   |
|  `C`  | `1100` |  `12`   |
|  `D`  | `1101` |  `13`   |
|  `E`  | `1110` |  `14`   |
|  `F`  | `1111` |  `15`   |

This repo uses the hex representation most commonly, but this page uses a mix of that and the binary one. Octal is rarely used outside of Unix permissions.

## Bit manipulation basics

Sometimes you want to select a range of bits. This is pretty easy, and it works by doing a logical AND against each bit in the number (hence, the "bitwise AND").

```js
mask & 0x14 // Selects the second and fourth bits from the mask
```

Sometimes, you instead want to merge bits. This is also pretty easy, and it works by doing a logical inclusive OR against each bit in the number (hence, the "bitwise OR").

```js
mask | 0x20 // Sets the fifth bit in the mask
```

And of course, sometimes, you want to invert bits. This is called a "bitwise NOT" because in effect, it's performing a logical NOT on each bit of the number.

```js
~mask // What was 1 is now 0, and what was 0 is now 1
```

On rare occasion, you want to toggle a bit. This is called a "bitwise XOR" because in effect, it's performing a logical exclusive OR on each bit of the number, setting each bit if either the first's or second's is clear, clearing it if either of them are set.

```js
mask ^ 0x10 // Sets the fourth bit if it's clear, clears it if it's set.
```

If you want a bit at a particular position, it's pretty easy: take a one and shift it by that position.

```js
1 << bitPos
```

If it's a constant, you'll often see it just written out as an integer literal.

```js
1 << 4
16 // Equivalent
```

Idiomatically, you'll more often see stuff like this written using hex literals or binary literals, using the bit width of the mask in question. It's a bit more concise, and if you're used to it, it's easy enough to read.

```js
1 << 4
0x10       // Equivalent
0b00010000 // Equivalent
```

## Bit testing

You can test if a bit is set in a mask by creating a number with only a single bit set at that position and then intersecting it with the mask. If it's zero, the bit is clear, and if it's equal to that mask (i.e. non-zero), the bit is set.

```js
(mask & 1 << bitPos) !== 0
(mask & (1 << bitPos)) !== 0 // Equivalent
```

If it's a constant, you'll often see the single-bit number just written out as a literal.

```js
(mask & 1 << 4) !== 0
(mask & 0x10) !== 0       // Equivalent
(mask & 0b00010000) !== 0 // Equivalent
```

You can expand this further and test multiple bits at the same time, seeing if any of them are set.

```js
(mask & (1 << 4 | 1 << 2)) !== 0
(mask & 0x14) !== 0       // Equivalent
(mask & 0b00010100) !== 0 // Equivalent
```

Note that bitwise operations have higher precedence than JavaScript's equality operators, so you need to be careful to include parentheses around the bitwise operation in question. Otherwise, you'll run into some very weird, hard-to-spot bugs with it.

```js
mask & 1 << bitPos !== 0
mask & ((1 << bitPos) !== 0) // Equivalent
```

## Bit comparison

In the previous section, I said you could test multiple bits at the same time to see if any of them are set.

```js
(mask & (1 << 4 | 1 << 2)) !== 0
(mask & 0x14) !== 0       // Equivalent
(mask & 0b00010100) !== 0 // Equivalent
```

You could similarly check if they are all set.

```js
(mask & (1 << 4 | 1 << 2)) === (1 << 4 | 1 << 2)
(mask & 0x14) === 0x14             // Equivalent
(mask & 0b00010100) === 0b00010100 // Equivalent
```

This carries to individual bits, too. Earlier, I showed you how you could check by comparing against 0.

```js
(mask & 1 << 4) !== 0
(mask & 0x10) !== 0       // Equivalent
(mask & 0b00010000) !== 0 // Equivalent
```

You can also compare against the isolated bit itself.

```js
(mask & 1 << 4) === (1 << 4)
(mask & 0x10) === 0x10             // Equivalent
(mask & 0b00010000) === 0b00010000 // Equivalent
```

You can get even crazier with this, by asserting two bits at the same time. This one asserts that only one of two bits is set, in parallel.

```js
(mask & (1 << 4 | 1 << 2)) === (0 << 4 | 1 << 2)
(mask & 0x14) === 0x04             // Equivalent
(mask & 0b00010100) === 0b00000100 // Equivalent
```

### Intermediate and advanced bit manipulation

There's [this wonderful resource](https://graphics.stanford.edu/~seander/bithacks.html) for some of the more advanced stuff. But beyond that, there's also a few others I'll just let sit here:

Clear a mask based on a condition, without branching:

```js
mask & -Boolean(foo)
foo ? mask : 0 // Equivalent
```

- This works because booleans, when coerced to numbers, evaluate to either 1 or 0. When you expand `-bool`, it ends up becoming `bool ? -1 : 0`. The two's complement representation of `-1` has all bits set, so `mask & -1` is equivalent to `mask`. The two's complement representation of `0` has all bits clear, so `mask & 0` is equivalent to `0`. This is how that works.
- Note: when `foo` is known to be a boolean or `1`/`0`, you don't need to coerce it here.
