/* global Mithril */
const {m, mount, Component: {isInitial, slot, component}} = Mithril

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

const Root = component(() => {
    const [current, setCurrent] = slot(0)
    if (isInitial()) {
        setInterval(() => setCurrent((current + 1) % cycles.length), 1000)
    }
    const [state, cells] = cycles[current]

    return cells.map((i) => m("div.slice", {
        class: {exit: state === "hide"},
        style: {backgroundPosition: backgroundPosition(i, 10)},
    }))
})

mount("#root").render(m(Root))
