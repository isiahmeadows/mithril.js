export var assign = Object.assign || function (target, source) {
	for (var key in source) {
		if (Object.prototype.hasOwnProperty.call(source, key)) {
			target[key] = source[key]
		}
	}
}
