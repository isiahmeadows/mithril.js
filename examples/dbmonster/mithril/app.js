(function () {
"use strict"

const {m, Stream} = Mithril

perfMonitor.startFPSMonitor()
perfMonitor.startMemMonitor()
perfMonitor.initProfiler("render")

function DBMon(attrs) {
	return m("div", [
		m("table.table.table-striped.latest-data", [
			m("tbody", Stream.map(attrs, ({data}) =>
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
	])
}

const root = document.getElementById("app")
function update() {
	requestAnimationFrame(update)

	const data = ENV.generateData()

	perfMonitor.startProfile("render")
	Mithril.render(root, m(DBMon, {data}))
	perfMonitor.endProfile("render")
}

update()
})()
