[*Up*](./README.md)

# Element type IDs

This is used to tie control elements and common tag names to element IDs. The ID is stored as an 8-bit integer within the mask for fast, easy access.

Special notes about chosen IDs here:

- All non-fragment control elements are intentionally 0 and 1, so they can be detected via `(vnode.mask & 0xFC) === 0x00`.
- All elements needing compared by tag are 8+, so they can be detected via `(vnode.mask & 0xF8) !== 0x00`.
- All control elements are 0-15, so they can be detected via `(vnode.mask & 0xF0) === 0x00`.
- Attributes are only considered significant on components and DOM vnodes, so they can be detected via `(vnode.mask & 0xFF) >= 0x0F`.
- Only one element type can have an instance: control vnodes.

Other notes:

- Types with asterisks have no fragment children. If a node carries this ID, its children are never recursed as a fragment tree.
	- Most control elements have their children recursed differently, so even though they include this asterisk, they still don't ignore their children.

## Control elements

- `(mask & 0xF0) === 0x00`

| Function      |   ID   | Example                                      |
|:-------------:|:------:|:-------------------------------------------- |
| Text*         | `0x00` | `m(Text, ...)`, `"..."`                      |
| Raw*          | `0x01` | `m(Raw, ...)`                                |
| Keyed*        | `0x02` | `m(Keyed, ...)`                              |
| Fragment      | `0x03` | `m(Fragment, ...)`, `[...]`                  |
| Control*      | `0x08` | `m(Control, ...)`, `(context) => ...`        |
| Component*    | `0x0F` | `m(Component, ...)`                          |

## DOM elements

- `(mask & 0xF0) !== 0x00`

| Tag name       |   ID   |
|:--------------:|:------:|
| Other element  | `0x10` |
| `<a>`          | `0x11` |
| `<abbr>`       | `0x12` |
| `<address>`    | `0x13` |
| `<area>`*      | `0x14` |
| `<article>`    | `0x15` |
| `<aside>`      | `0x16` |
| `<audio>`      | `0x17` |
| `<b>`          | `0x18` |
| `<base>`*      | `0x19` |
| `<bdi>`        | `0x1A` |
| `<bdo>`        | `0x1B` |
| `<blockquote>` | `0x1C` |
| `<body>`       | `0x1D` |
| `<br>`*        | `0x1E` |
| `<button>`     | `0x1F` |
| `<canvas>`     | `0x20` |
| `<caption>`    | `0x21` |
| `<cite>`       | `0x22` |
| `<code>`       | `0x23` |
| `<col>`*       | `0x24` |
| `<colgroup>`   | `0x25` |
| `<data>`       | `0x26` |
| `<datalist>`   | `0x27` |
| `<dd>`         | `0x28` |
| `<del>`        | `0x29` |
| `<details>`    | `0x2A` |
| `<dfn>`        | `0x2B` |
| `<dialog>`     | `0x2C` |
| `<div>`        | `0x2D` |
| `<dl>`         | `0x2E` |
| `<dt>`         | `0x2F` |
| `<em>`         | `0x30` |
| `<embed>`*     | `0x31` |
| `<fieldset>`   | `0x32` |
| `<figcaption>` | `0x33` |
| `<figure>`     | `0x34` |
| `<footer>`     | `0x35` |
| `<form>`       | `0x36` |
| `<h1>`         | `0x37` |
| `<h2>`         | `0x38` |
| `<h3>`         | `0x39` |
| `<h4>`         | `0x3A` |
| `<h5>`         | `0x3B` |
| `<h6>`         | `0x3C` |
| `<head>`       | `0x3D` |
| `<header>`     | `0x3E` |
| `<hgroup>`     | `0x3F` |
| `<hr>`*        | `0x40` |
| `<html>`       | `0x41` |
| `<i>`          | `0x42` |
| `<iframe>`     | `0x43` |
| `<img>`*       | `0x44` |
| `<input>`*     | `0x45` |
| `<ins>`        | `0x46` |
| `<kbd>`        | `0x47` |
| `<label>`      | `0x48` |
| `<legend>`     | `0x49` |
| `<li>`         | `0x4A` |
| `<link>`*      | `0x4B` |
| `<main>`       | `0x4C` |
| `<map>`        | `0x4D` |
| `<mark>`       | `0x4E` |
| `<menu>`       | `0x4F` |
| `<meta>`*      | `0x50` |
| `<meter>`      | `0x51` |
| `<nav>`        | `0x52` |
| `<noscript>`   | `0x53` |
| `<object>`     | `0x54` |
| `<ol>`         | `0x55` |
| `<optgroup>`   | `0x56` |
| `<option>`     | `0x57` |
| `<output>`     | `0x58` |
| `<p>`          | `0x59` |
| `<param>`*     | `0x5A` |
| `<picture>`    | `0x5B` |
| `<pre>`        | `0x5C` |
| `<progress>`   | `0x5D` |
| `<q>`          | `0x5E` |
| `<rp>`         | `0x5F` |
| `<rt>`         | `0x60` |
| `<ruby>`       | `0x61` |
| `<s>`          | `0x62` |
| `<samp>`       | `0x63` |
| `<script>`     | `0x64` |
| `<section>`    | `0x65` |
| `<select>`     | `0x66` |
| `<slot>`       | `0x67` |
| `<small>`      | `0x68` |
| `<source>`*    | `0x69` |
| `<span>`       | `0x6A` |
| `<strong>`     | `0x6B` |
| `<style>`      | `0x6C` |
| `<sub>`        | `0x6D` |
| `<summary>`    | `0x6E` |
| `<sup>`        | `0x6F` |
| `<table>`      | `0x70` |
| `<tbody>`      | `0x71` |
| `<td>`         | `0x72` |
| `<template>`   | `0x73` |
| `<textarea>`   | `0x74` |
| `<tfoot>`      | `0x75` |
| `<th>`         | `0x76` |
| `<thead>`      | `0x77` |
| `<time>`       | `0x78` |
| `<title>`      | `0x79` |
| `<tr>`         | `0x7A` |
| `<track>`*     | `0x7B` |
| `<u>`          | `0x7C` |
| `<ul>`         | `0x7D` |
| `<var>`        | `0x7E` |
| `<video>`      | `0x7F` |
| `<wbr>`*       | `0x80` |

Unknown elements are *typically* SVG or MathML elements, but not always.
