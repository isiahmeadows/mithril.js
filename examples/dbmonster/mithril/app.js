(function () {
"use strict"
const {m, Cell} = Mithril

perfMonitor.startFPSMonitor()
perfMonitor.startMemMonitor()
perfMonitor.initProfiler("render")

function dataStream(send) {
	loop()
	function loop() {
		requestAnimationFrame(loop)
		perfMonitor.startProfile("render")
		send(ENV.generateData().toArray()).then(() => {
			perfMonitor.endProfile("render")
		})
	}
}

Mithril.render(document.getElementById("app"), m("div", [
	m("table.table.table-striped.latest-data", [
		m("tbody", Cell.map(dataStream, (data) =>
			m("#keyed", data.map(({dbname, lastSample}) =>
				m("tr", {key: dbname}, [
					m("td.dbname", dbname),
					m("td.query-count", [
						m("span", {class: lastSample.countClassName}, [
							lastSample.nbQueries
						])
					]),
					lastSample.topFiveQueries.map((query) =>
						m("td", {class: query.elapsedClassName}, [
							query.formatElapsed,
							m("div.popover.left", [
								m("div.popover-content", query.query),
								m("div.arrow")
							])
						])
					)
				])
			))
		))
	])
]))
})()
