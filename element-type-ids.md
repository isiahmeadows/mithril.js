[*Up*](./README.md)

# Element type IDs

This is used to tie control elements and common tag names to element IDs. The ID is stored as an 8-bit integer within the mask for fast, easy access.

Special notes about chosen IDs here:

- All non-fragment control elements are intentionally 0-8, so they can be detected via `(vnode.mask & 0xF0) === 0x00`.
- All elements needing compared by tag are 8-9, so they can be detected via `(vnode.mask & 0xFE) === 0x08`.
- Only one element type can have an instance: components.

Other notes:

- Types with asterisks cannot have children. If a node carries this ID, its children are never recursed as a vnode tree.
	- Most control elements have their "children" recursed differently, so even though they include this asterisk, they still don't ignore their "children".

## Control elements

- `(mask & 0xF0) === 0x00`

| Function      |   ID   | Example                                    |
|:-------------:|:------:|:------------------------------------------ |
| Retain*       | `0x00` | `m(Retain)`                                |
| Text*         | `0x01` | `m(Text, ...)`, `"..."`                    |
| Raw*          | `0x02` | `m(Raw, ...)`                              |
| Keyed*        | `0x03` | `m(Keyed, ...)`                            |
| Component*    | `0x08` | `m(Component, ...)`                        |
| Other element | `0x09` | `m("feMatrix", ...)`, `m("mo", ...)`, etc. |
| Fragment      | `0x0A` | `m(Fragment, ...)`, `[...]`                |
| Portal Get    | `0x0C` | `m(PortalGet, ...)`                        |
| Portal Set    | `0x0D` | `m(PortalSet, ...)`                        |

Unknown elements are *typically* SVG or MathML elements, but not always.

## HTML elements

- `(mask & 0xF0) !== 0x00`

| Tag name       |   ID   |
|:--------------:|:------:|
| `<a>`          | `0x10` |
| `<abbr>`       | `0x11` |
| `<address>`    | `0x12` |
| `<area>`*      | `0x13` |
| `<article>`    | `0x14` |
| `<aside>`      | `0x15` |
| `<audio>`      | `0x16` |
| `<b>`          | `0x17` |
| `<base>`*      | `0x18` |
| `<bdi>`        | `0x19` |
| `<bdo>`        | `0x1A` |
| `<blockquote>` | `0x1B` |
| `<body>`       | `0x1C` |
| `<br>`*        | `0x1D` |
| `<button>`     | `0x1E` |
| `<canvas>`     | `0x1F` |
| `<caption>`    | `0x20` |
| `<cite>`       | `0x21` |
| `<code>`       | `0x22` |
| `<col>`*       | `0x23` |
| `<colgroup>`   | `0x24` |
| `<data>`       | `0x25` |
| `<datalist>`   | `0x26` |
| `<dd>`         | `0x27` |
| `<del>`        | `0x28` |
| `<details>`    | `0x29` |
| `<dfn>`        | `0x2A` |
| `<dialog>`     | `0x2B` |
| `<div>`        | `0x2C` |
| `<dl>`         | `0x2D` |
| `<dt>`         | `0x2E` |
| `<em>`         | `0x2F` |
| `<embed>`*     | `0x30` |
| `<fieldset>`   | `0x31` |
| `<figcaption>` | `0x32` |
| `<figure>`     | `0x33` |
| `<footer>`     | `0x34` |
| `<form>`       | `0x35` |
| `<h1>`         | `0x36` |
| `<h2>`         | `0x37` |
| `<h3>`         | `0x38` |
| `<h4>`         | `0x39` |
| `<h5>`         | `0x3A` |
| `<h6>`         | `0x3B` |
| `<head>`       | `0x3C` |
| `<header>`     | `0x3D` |
| `<hgroup>`     | `0x3E` |
| `<hr>`*        | `0x3F` |
| `<html>`       | `0x40` |
| `<i>`          | `0x41` |
| `<iframe>`     | `0x42` |
| `<img>`*       | `0x43` |
| `<input>`*     | `0x44` |
| `<ins>`        | `0x45` |
| `<kbd>`        | `0x46` |
| `<label>`      | `0x47` |
| `<legend>`     | `0x48` |
| `<li>`         | `0x49` |
| `<link>`*      | `0x4A` |
| `<main>`       | `0x4B` |
| `<map>`        | `0x4C` |
| `<mark>`       | `0x4D` |
| `<menu>`       | `0x4E` |
| `<meta>`*      | `0x4F` |
| `<meter>`      | `0x50` |
| `<nav>`        | `0x51` |
| `<noscript>`   | `0x52` |
| `<object>`     | `0x53` |
| `<ol>`         | `0x54` |
| `<optgroup>`   | `0x55` |
| `<option>`     | `0x56` |
| `<output>`     | `0x57` |
| `<p>`          | `0x58` |
| `<param>`*     | `0x59` |
| `<picture>`    | `0x5A` |
| `<pre>`        | `0x5B` |
| `<progress>`   | `0x5C` |
| `<q>`          | `0x5D` |
| `<rp>`         | `0x5E` |
| `<rt>`         | `0x5F` |
| `<ruby>`       | `0x60` |
| `<s>`          | `0x61` |
| `<samp>`       | `0x62` |
| `<script>`     | `0x63` |
| `<section>`    | `0x64` |
| `<select>`     | `0x65` |
| `<slot>`       | `0x66` |
| `<small>`      | `0x67` |
| `<source>`*    | `0x68` |
| `<span>`       | `0x69` |
| `<strong>`     | `0x6A` |
| `<style>`      | `0x6B` |
| `<sub>`        | `0x6C` |
| `<summary>`    | `0x6D` |
| `<sup>`        | `0x6E` |
| `<table>`      | `0x6F` |
| `<tbody>`      | `0x70` |
| `<td>`         | `0x71` |
| `<template>`   | `0x72` |
| `<textarea>`   | `0x73` |
| `<tfoot>`      | `0x74` |
| `<th>`         | `0x75` |
| `<thead>`      | `0x76` |
| `<time>`       | `0x77` |
| `<title>`      | `0x78` |
| `<tr>`         | `0x79` |
| `<track>`*     | `0x7A` |
| `<u>`          | `0x7B` |
| `<ul>`         | `0x7C` |
| `<var>`        | `0x7D` |
| `<video>`      | `0x7E` |
| `<wbr>`*       | `0x7F` |
