import {Raw, Retain, m} from "mithril/m"

// Not using the proper parent makes the child element(s) vanish.
//     var div = document.createElement("div")
//     div.innerHTML = "<td>i</td><td>j</td>"
//     console.log(div.innerHTML)
// --> "ij", no <td> in sight.
export default function Trust({tag = "div", xmlns = null, children}) {
	return (context, prev) => {
		const raw = children.join("")
		if (context.renderType() === "html") return m(Raw, raw)
		if (prev != null && (
			prev.tag === tag && prev.xmlns === xmlns && prev.raw === raw
		)) {
			return m(Retain)
		}
		let temp = xmlns != null
			? document.createElementNS(tag, xmlns)
			: document.createElement(tag)

		temp.innerHTML = raw
		const nodes = []
		for (temp = temp.firstChild; temp != null; temp = temp.nextSibling) {
			nodes.push(temp)
		}
		return {state: {tag, xmlns, raw}, ref: nodes, value: m(Raw, nodes)}
	}
}
