import {RETAIN_MEMO, create} from "mithril/m"

// Not using the proper parent makes the child element(s) vanish.
//     var div = document.createElement("div")
//     div.innerHTML = "<td>i</td><td>j</td>"
//     console.log(div.innerHTML)
// --> "ij", no <td> in sight.
export default function Trust(attrs) {
	var tag = attrs.tag || "div"
	var xmlns = attrs.xmlns
	var raw = attrs.children.join("")

	return function (context, state) {
		if (context.renderType() === "html") {
			return create(0x02, void 0, void 0, raw, void 0, void 0)
		}
		if (state == null) {
			state = {t: void 0, x: void 0, r: void 0}
		} else if (state.t === tag && state.x === xmlns && state.r === raw) {
			return RETAIN_MEMO
		}
		state.t = tag
		state.x = xmlns
		state.r = raw
		var node = xmlns != null
			? document.createElementNS(tag, xmlns)
			: document.createElement(tag)

		node.innerHTML = raw
		var nodes = []
		// No need to remove the child - the renderer will take care of that
		// when adding it to the live tree.
		for (node = node.firstChild; node != null; node = node.nextSibling) {
			nodes.push(node)
		}

		return {
			state: state,
			ref: nodes,
			value: create(0x02, void 0, void 0, nodes, void 0, void 0)
		}
	}
}
