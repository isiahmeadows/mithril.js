"use strict"

var o = require("ospec")
var domMock = require("../../test-utils/domMock")
var loadMithril = require("../../test-utils/loadMithril")

o.spec("form inputs", function() {
	var $window, root, render
	o.beforeEach(function() {
		$window = domMock()
		render = loadMithril({window: $window}).render
		root = $window.document.createElement("div")
		$window.document.body.appendChild(root)
	})
	o.afterEach(function() {
		while (root.firstChild) root.removeChild(root.firstChild)
		root.vnodes = null
	})

	o.spec("input", function() {
		o("maintains focus after move", function() {
			var input = {tag: "input", key: 1}
			var a = {tag: "a", key: 2}
			var b = {tag: "b", key: 3}

			render(root, [input, a, b])
			input.dom.focus()
			render(root, [a, input, b])

			o($window.document.activeElement).equals(input.dom)
		})

		o("maintains focus when changed manually in hook", function() {
			var input = {tag: "input", attrs: {oncreate: function() {
				input.dom.focus();
			}}};

			render(root, [input])

			o($window.document.activeElement).equals(input.dom)
		})

		o("syncs input value if DOM value differs from vdom value", function() {
			var input = {tag: "input", attrs: {value: "aaa", oninput: function() {}}}
			var updated = {tag: "input", attrs: {value: "aaa", oninput: function() {}}}

			render(root, [input])

			//simulate user typing
			var e = $window.document.createEvent("KeyboardEvent")
			e.initEvent("input", true, true)
			input.dom.focus()
			input.dom.value += "a"
			input.dom.dispatchEvent(e)

			//re-render may use same vdom value as previous render call
			render(root, [updated])

			o(updated.dom.value).equals("aaa")
		})

		o("clear element value if vdom value is set to undefined (aka removed)", function() {
			var input = {tag: "input", attrs: {value: "aaa", oninput: function() {}}}
			var updated = {tag: "input", attrs: {value: undefined, oninput: function() {}}}

			render(root, [input])
			render(root, [updated])

			o(updated.dom.value).equals("")
		})

		o("syncs input checked attribute if DOM value differs from vdom value", function() {
			var input = {tag: "input", attrs: {type: "checkbox", checked: true, onclick: function() {}}}
			var updated = {tag: "input", attrs: {type: "checkbox", checked: true, onclick: function() {}}}

			render(root, [input])

			//simulate user clicking checkbox
			var e = $window.document.createEvent("MouseEvents")
			e.initEvent("click", true, true)
			input.dom.focus()
			input.dom.dispatchEvent(e)

			//re-render may use same vdom value as previous render call
			render(root, [updated])

			o(updated.dom.checked).equals(true)
		})

		o("syncs file input value attribute if DOM value differs from vdom value and is empty", function() {
			var input = {tag: "input", attrs: {type: "file", value: "", onclick: function() {}}}
			var updated = {tag: "input", attrs: {type: "file", value: "", onclick: function() {}}}
			var spy = o.spy()
			var error = console.error

			render(root, [input])

			input.dom.value = "test.png"

			try {
				console.error = spy
				render(root, [updated])
			} finally {
				console.error = error
			}

			o(updated.dom.value).equals("")
			o(spy.callCount).equals(0)
		})

		o("warns and ignores file input value attribute if DOM value differs from vdom value and is non-empty", function() {
			var input = {tag: "input", attrs: {type: "file", value: "", onclick: function() {}}}
			var updated = {tag: "input", attrs: {type: "file", value: "other.png", onclick: function() {}}}
			var spy = o.spy()
			var error = console.error

			render(root, [input])

			input.dom.value = "test.png"

			try {
				console.error = spy
				render(root, [updated])
			} finally {
				console.error = error
			}

			o(updated.dom.value).equals("test.png")
			o(spy.callCount).equals(1)
		})

		o("retains file input value attribute if DOM value is the same as vdom value and is non-empty", function() {
			var $window = domMock(o)
			var render = loadMithril({window: $window}).render
			var root = $window.document.createElement("div")
			$window.document.body.appendChild(root)
			var input = {tag: "input", attrs: {type: "file", value: "", onclick: function() {}}}
			var updated1 = {tag: "input", attrs: {type: "file", value: "test.png", onclick: function() {}}}
			var updated2 = {tag: "input", attrs: {type: "file", value: "test.png", onclick: function() {}}}
			var spy = o.spy()
			var error = console.error

			render(root, [input])

			// Verify our assumptions about the outer element state
			o($window.__getSpies(input.dom).valueSetter.callCount).equals(0)
			input.dom.value = "test.png"
			o($window.__getSpies(input.dom).valueSetter.callCount).equals(1)

			try {
				console.error = spy
				render(root, [updated1])
			} finally {
				console.error = error
			}

			o(updated1.dom.value).equals("test.png")
			o(spy.callCount).equals(0)
			o($window.__getSpies(updated1.dom).valueSetter.callCount).equals(1)

			try {
				console.error = spy
				render(root, [updated2])
			} finally {
				console.error = error
			}

			o(updated2.dom.value).equals("test.png")
			o(spy.callCount).equals(0)
			o($window.__getSpies(updated2.dom).valueSetter.callCount).equals(1)
		})
	})

	o.spec("select", function() {
		o("select works without attributes", function() {
			var select = {tag: "select", children: [
				{tag: "option", attrs: {value: "a"}, text: "aaa"},
			]}

			render(root, [select])

			o(select.dom.value).equals("a")
			o(select.dom.selectedIndex).equals(0)
		})

		o("select option can have empty string value", function() {
			var select = {tag: "select", children :[
				{tag: "option", attrs: {value: ""}, text: "aaa"}
			]}

			render(root, [select])

			o(select.dom.firstChild.value).equals("")
		})

		o("option value defaults to textContent unless explicitly set", function() {
			var select = {tag: "select", children :[
				{tag: "option", text: "aaa"}
			]}

			render(root, [select])

			o(select.dom.firstChild.value).equals("aaa")
			o(select.dom.value).equals("aaa")

			//test that value changes when content changes
			select = {tag: "select", children :[
				{tag: "option", text: "bbb"}
			]}

			render(root, [select])

			o(select.dom.firstChild.value).equals("bbb")
			o(select.dom.value).equals("bbb")

			//test that value can be set to "" in subsequent render
			select = {tag: "select", children :[
				{tag: "option", attrs: {value: ""}, text: "aaa"}
			]}

			render(root, [select])

			o(select.dom.firstChild.value).equals("")
			o(select.dom.value).equals("")

			//test that value reverts to textContent when value omitted
			select = {tag: "select", children :[
				{tag: "option", text: "aaa"}
			]}

			render(root, [select])

			o(select.dom.firstChild.value).equals("aaa")
			o(select.dom.value).equals("aaa")
		})

		o("select yields invalid value without children", function() {
			var select = {tag: "select", attrs: {value: "a"}}

			render(root, [select])

			o(select.dom.value).equals("")
			o(select.dom.selectedIndex).equals(-1)
		})

		o("select value is set correctly on first render", function() {
			var select = {tag: "select", attrs: {value: "b"}, children: [
				{tag: "option", attrs: {value: "a"}, text: "aaa"},
				{tag: "option", attrs: {value: "b"}, text: "bbb"},
				{tag: "option", attrs: {value: "c"}, text: "ccc"},
			]}

			render(root, [select])

			o(select.dom.value).equals("b")
			o(select.dom.selectedIndex).equals(1)
		})

		o("syncs select value if DOM value differs from vdom value", function() {
			function makeSelect() {
				return {tag: "select", attrs: {value: "b"}, children: [
					{tag: "option", attrs: {value: "a"}, text: "aaa"},
					{tag: "option", attrs: {value: "b"}, text: "bbb"},
					{tag: "option", attrs: {value: "c"}, text: "ccc"},
				]}
			}

			render(root, [makeSelect()])

			//simulate user selecting option
			root.firstChild.value = "c"
			root.firstChild.focus()

			//re-render may use same vdom value as previous render call
			render(root, [makeSelect()])

			o(root.firstChild.value).equals("b")
			o(root.firstChild.selectedIndex).equals(1)
		})
	})

	o.spec("textarea", function() {
		o("updates after user input", function() {
			render(root, [{tag: "textarea", text: "aaa"}])

			//simulate typing
			root.firstChild.value = "bbb"

			//re-render may occur after value attribute is touched
			render(root, [{tag: "textarea", text: "ccc"}])

			o(root.firstChild.value).equals("ccc")
			//FIXME should fail if fix is commented out
		})
	})
})