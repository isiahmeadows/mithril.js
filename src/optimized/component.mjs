function ClosureContext(context) {
	this._c = context
	this.done = this.ref = this._p = this._v = void 0
}

ClosureContext.prototype.isSerializing = function () {
	return this._c.isSerializing()
}

ClosureContext.prototype.update = function () {
	return this._c.update()
}

ClosureContext.prototype.updateSync = function () {
	return this._c.updateSync()
}

export function component(init) {
	return (attrs) => (context, state) => {
		if (state == null) {
			state = new ClosureContext(context)
			state._v = init(attrs, state)
		}
		var prev = state._p
		state._p = attrs
		state._c = context
		return {
			state: state,
			done: state.done,
			ref: state.ref,
			value: (0, state._v)(attrs, prev)
		}
	}
}
