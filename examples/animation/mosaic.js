/* global Mithril */
const {m, mount} = Mithril

function range(start, end) {
    const result = []
    for (var i = start; i < end; i++) result.push(i)
    return result
}

const backgroundPosition = (i, step) =>
    // X% Y%
    `${i % step * (step + 1)}% ${Math.floor(i / step) * (step + 1)}%`

const cycles = [
    ["show", range(0, 100)], ["show", range(0, 100)],
    ["hide", range(0, 100)], ["hide", []],
]

function Root(_, info) {
    if (info.state == null) {
        info.state = 0
        setInterval(() => {
            info.state = (info.state + 1) % cycles.length
            info.redraw()
        }, 1000)
    }

    const [state, cells] = cycles[info.state]

    return cells.map((i) => m("div.slice", {
        class: {exit: state === "hide"},
        style: {backgroundPosition: backgroundPosition(i, 10)},
    }))
}

mount("#root").render(m(Root))
