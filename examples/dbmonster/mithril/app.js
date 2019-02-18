"use strict"

const {m, Fragment, Keyed, mount} = Mithril

perfMonitor.startFPSMonitor()
perfMonitor.startMemMonitor()
perfMonitor.initProfiler("render")

function App(attrs, context, isReady = false) {
	if (!isReady) {
		function update() {
			requestAnimationFrame(update)
			perfMonitor.startProfile("render")
			context.update(ENV.generateData().toArray()).then(() => {
				perfMonitor.endProfile("render")
			})
		}
		update()
	}

	return {
		next: true,
		view: m("div", [
			m("table.table.table-striped.latest-data", [
				m("tbody", m(Keyed, data.map(({dbname, lastSample}) =>
					m("tr", {key: dbname}, [
						m("td.dbname", dbname),
						m("td.query-count", [
							m("span", {class: lastSample.countClassName}, [
								lastSample.nbQueries
							])
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
				)))
			])
		])
	}
}

mount(document.getElementById("app"), () => m(App))
