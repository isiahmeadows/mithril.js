(function () {
"use strict"

const {m} = Mithril

perfMonitor.startFPSMonitor()
perfMonitor.startMemMonitor()
perfMonitor.initProfiler("render")

function DBMon({data}) {
    return m("div", m("table.table.table-striped.latest-data", m("tbody",
        m.each(data, "dbname", ({dbname, lastSample}) => m("tr",
            m("td.dbname", dbname),
            m("td.query-count",
                m("span", {class: lastSample.countClassName},
                    lastSample.nbQueries
                )
            ),
            lastSample.topFiveQueries.map((query) =>
                m("td", {class: query.elapsedClassName},
                    query.formatElapsed,
                    m("div.popover.left", [
                        m("div.popover-content", query.query),
                        m("div.arrow")
                    ])
                )
            )
        ))
    )))
}

const handle = Mithril.mount("#app")

function update() {
    requestAnimationFrame(update)

    const data = ENV.generateData()
    perfMonitor.startProfile("render")

    handle.render(
        m(DBMon, {data}),
        m.capture(() => { perfMonitor.endProfile("render") })
    )
}

update()
})()
