import {create} from "mithril/m"

function createRaw(children) {
	return create(0x02, void 0, void 0, children, void 0, void 0)
}

function htmlContext(render) {
	return function (current) { render(createRaw(current.children.join(""))) }
}

// Not using the proper parent makes the child element(s) vanish.
//     var div = document.createElement("div")
//     div.innerHTML = "<td>i</td><td>j</td>"
//     console.log(div.innerHTML)
// --> "ij", no <td> in sight.
export default function Trust(attrs) {
	return function (render, context) {
		if (context.renderType() === "html") return attrs(htmlContext(render))
		var tag, xmlns, raw

		return attrs(function (current) {
			var nextTag = current.tag || "div"
			var nextXmlns = current.xmlns
			var nextRaw = current.children.join("")

			if (
				raw != null &&
				nextTag === tag && nextXmlns === xmlns && nextRaw === raw
			) return
			tag = nextTag; xmlns = nextXmlns; raw = nextRaw

			var node = document.createElementNS(xmlns, tag)
			node.innerHTML = raw
			// No need to remove the child - the renderer will take care of
			// that implicitly when adding it to the live tree.
			var nodes = []
			for (node = node.firstChild; node != null; node = node.nextSibling) {
				nodes.push(node)
			}

			render(createRaw(nodes), nodes)
		})
	}
}
