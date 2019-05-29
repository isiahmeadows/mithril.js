import * as Stream from "../src/stream.mjs"

// Note: this needs to test horribly obscure edge cases, too, like:
//
// - The madness detailed in `trackerCreate` and friends.
// - Closing and/or erroring every stream during `next`, `error`, and `complete`
// - Closing and/or erroring `map` and friends during the callback
// - Invoking `next`, `error`, and/or `complete` during the callback of
//   `onClose`
// - Invoking `next`, `error`, and/or `complete` during closure of streams
//   passed to all functions
// - Emitting `next`, `error`, and/or `complete` during the callback of
//   `recover`

function spyStream() {
	function stream() {
		var args = []
		for (var i = 0; i < arguments.length; i++) args[i] = arguments[i]
		stream.subs.push(args)
	}
	stream.subs = []
	stream.send = function () {
		for (var i = 0; i < stream.subs.length; i++) {
			stream.subs[i].apply(null, arguments)
		}
	}
	return stream
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

describe("mithril/stream", function () {
	describe("all()", function () {
		it("works with zero sources + no callback", function () {
			var all = Stream.all([])
			var send = spySend()

			all(send)
			assert.equal(send.calls, [
				{this: undefined, args: [[]]}
			])
		})

		it("works with zero sources + no callback", function () {
			function sentinel() {}
			var all = Stream.all([])
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
