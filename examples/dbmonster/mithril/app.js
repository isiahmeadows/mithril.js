(function () {
"use strict"

perfMonitor.startFPSMonitor()
perfMonitor.startMemMonitor()
perfMonitor.initProfiler("render")

function DBMon(ctrl, attrs) {
    return m("div", m("table.table.table-striped.latest-data", m("tbody",
        m.each(attrs.data, "dbname", ({dbname, lastSample}) =>
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
    )))
}

m.render("#app", (ctrl) => {
    const data = ENV.generateData()
    perfMonitor.startProfile("render")
    ctrl.afterCommit(() => {
        perfMonitor.endProfile("render")
        ctrl.redraw() // Keep the loop going
    })
    return m(DBMon, {data})
})
})()
