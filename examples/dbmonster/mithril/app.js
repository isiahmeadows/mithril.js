(function () {
"use strict"

const {m, keyed, Stream} = Mithril

perfMonitor.startFPSMonitor()
perfMonitor.startMemMonitor()
perfMonitor.initProfiler("render")

function DBMon(attrs) {
	return m("div > table.table.table-striped.latest-data > tbody",
		keyed(Stream.map(attrs, "data"), "dbname", ({dbname, lastSample}) =>
			m("tr", [
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
		)
	)
}

const root = document.getElementById("app")
function update() {
	requestAnimationFrame(update)

	const data = ENV.generateData()

	perfMonitor.startProfile("render")
	Mithril.render(root, m(DBMon, {data, afterCommit() {
		perfMonitor.endProfile("render")
	}}))
}

update()
})()
