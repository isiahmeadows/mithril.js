import {Raw, m} from "mithril/m"

function htmlContext(render) {
	return (current) => { render(m(Raw, current.children.join(""))) }
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

		return attrs((current) => {
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
			// that when adding it to the live tree.
			var nodes = [].slice.call(node.childNodes)
			context.render(m(Raw, nodes), nodes)
		})
	}
}
