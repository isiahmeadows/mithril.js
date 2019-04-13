import * as Cell from "../src/cell.mjs"

function spyCell() {
	function cell() {
		var args = []
		for (var i = 0; i < arguments.length; i++) args[i] = arguments[i]
		cell.subs.push(args)
	}
	cell.subs = []
	cell.send = function () {
		for (var i = 0; i < cell.subs.length; i++) {
			cell.subs[i].apply(null, arguments)
		}
	}
	return cell
}

function spySend() {
	function send() {
		var args = []
		for (var i = 0; i < arguments.length; i++) args[i] = arguments[i]
		send.calls.push({this: this, args: args})
	}
	send.calls = []
	return send
}

describe("mithril/cell", function () {
	describe("all()", function () {
		it("works with zero sources + no callback", function () {
			var all = Cell.all([])
			var send = spySend()

			all(send)
			assert.equal(send.calls, [
				{this: undefined, args: [[]]}
			])
		})

		it("works with zero sources + no callback", function () {
			function sentinel() {}
			var all = Cell.all([])
			var func = spySend()
			var send = spySend()

			all(send, function () {
				func.apply(this, arguments)
				return sentinel
			})
			assert.equal(func.calls, [
				{this: undefined, args: [[]]}
			])
			assert.equal(send.calls, [
				{this: undefined, args: [sentinel]}
			])
		})
	})

	describe("join()", function () {
		// TODO
	})

	describe("run()", function () {
		// TODO
	})

	describe("map()", function () {
		// TODO
	})

	describe("tap()", function () {
		// TODO
	})

	describe("filter()", function () {
		// TODO
	})

	describe("scan()", function () {
		// TODO
	})

	describe("scanMap()", function () {
		// TODO
	})

	describe("reduce()", function () {
		// TODO
	})

	describe("distinct()", function () {
		// TODO
	})

	describe("of()", function () {
		// TODO
	})

	describe("merge()", function () {
		// TODO
	})

	describe("NEVER", function () {
		// TODO
	})

	describe("chain()", function () {
		// TODO
	})

	describe("onDone()", function () {
		// TODO
	})

	describe("shallowEqual()", function () {
		// TODO
	})
})
