"use strict"

const {m, mount} = Mithril

perfMonitor.startFPSMonitor()
perfMonitor.startMemMonitor()
perfMonitor.initProfiler("render")

mount(document.getElementById("app"), () => (context, data = []) => {
	if (context.isInit) {
		function update() {
			requestAnimationFrame(update)
			perfMonitor.startProfile("render")
			context.update(ENV.generateData().toArray()).then(() => {
				perfMonitor.endProfile("render")
			})
		}
		update()
	}

	return m("div", [
		m("table.table.table-striped.latest-data", [
			m("tbody", data.map(({dbname, lastSample}) =>
				m("tr", {key: dbname}, [
					m("td.dbname", dbname),
					m("td.query-count", [
						m("span", {class: lastSample.countClassName}, lastSample.nbQueries)
					]),
					lastSample.topFiveQueries.map(query =>
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
		])
	])
})
