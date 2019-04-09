(function () {
"use strict"

const h = React.createElement

perfMonitor.startFPSMonitor()
perfMonitor.startMemMonitor()
perfMonitor.initProfiler("render")

class DBMon extends React.Component {
	render() {
		return h("div", null,
			h("table", {className: "table table-striped latest-data"},
				h("tbody", null,
					this.props.data.map(({dbname, lastSample}) =>
						h("tr", {key: dbname},
							h("td", {className: "dbname"}, dbname),
							h("td", {className: "query-count"},
								h("span",
									{className: lastSample.countClassName},
									lastSample.nbQueries
								)
							),
							lastSample.topFiveQueries.map((query) =>
								h("td", {className: query.elapsedClassName},
									query.formatElapsed,
									h("div", {className: "popover left"},
										h("div", {className: "popover-content"},
											query.query
										),
										h("div", {className: "arrow"})
									)
								)
							)
						))
				)
			)
		)
	}
}

const root = document.getElementById("app")
function update() {
	requestAnimationFrame(update)

	const data = ENV.generateData()

	perfMonitor.startProfile("render")
	ReactDOM.render(h(DBMon, {data}), root)
	perfMonitor.endProfile("render")
}

update()
})()
