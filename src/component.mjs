export function component(init) {
	return (attrs) => (context, state) => {
		if (state == null) {
			state = {
				prev: undefined,
				current: context,
				context: {
					isSerializing: () => state.current.isSerializing(),
					update: () => state.current.update(),
					updateSync: () => state.current.updateSync(),
					done: undefined,
					ref: undefined,
				},
				view: undefined,
			}
			state.view = init(attrs, state.context)
		}
		const {context: {done, ref}, view, prev} = state
		state.current = context
		state.prev = attrs
		return {state, done, ref, value: view(attrs, prev)}
	}
}
