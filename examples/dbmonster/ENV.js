window.ENV = window.ENV || (function() {
"use strict"

const ROWS = 50
let counter = 0
let data

function getElapsedClassName(elapsed) {
    if (elapsed >= 10) return "query elapsed warn_long"
    if (elapsed >= 1) return "query elapsed warn"
    return "query elapsed short"
}

function countClassName(queries) {
    if (queries >= 10) return "label label-important"
    if (queries >= 1) return "label label-warning"
    return "label label-success"
}

function getQuery(query) {
    if (query >= 0.2) return "<IDLE> in transaction"
    if (query >= 0.1) return "vacuum"
    return "SELECT blah FROM something"
}

function makeCleanQueryRow() {
    const queries = []
    for (let i = 0; i < 12; i++) {
        queries[i] = {
            query: "***",
            formatElapsed: "",
            elapsedClassName: "",
            elapsed: null,
            waiting: null,
        }
    }
    return queries
}

function updateQueryRow(queries, nbQueries) {
    for (let i = 0; i < nbQueries; i++) {
        const elapsed = Math.random() * 15
        queries[i].elapsed = elapsed
        queries[i].formatElapsed = parseFloat(elapsed).toFixed(2)
        queries[i].elapsedClassName = getElapsedClassName(elapsed)
    }
    for (let i = 0; i < nbQueries; i++) {
        queries[i].waiting = Math.random() < 0.5
    }
    for (let i = 0; i < nbQueries; i++) {
        queries[i].query = getQuery(Math.random())
    }
}

function makeCleanRow(name) {
    return {
        dbname: name,
        query: "",
        formatElapsed: "",
        elapsedClassName: "",
        lastMutationId: null,
        nbQueries: null,
        lastSample: null,
    }
}

function makeCleanData() {
    const data = []
    for (let i = 1; i <= ROWS; i++) {
        data.push(makeCleanRow(`cluster${i}`))
        data.push(makeCleanRow(`cluster${i} slave`))
    }
    return data
}

let mutationsValue = 0.5
const sliderContainer = document.createElement("div")
sliderContainer.style.display = "flex"
const slider = document.createElement("input")
const text = document.createElement("label")
text.textContent = `mutations : ${(mutationsValue * 100).toFixed(0)}%`
slider.type = "range"
slider.style.marginBottom = "10px"
slider.style.marginTop = "5px"
slider.addEventListener("change", (e) => {
    mutationsValue = e.target.value / 100
    text.innerHTML = `mutations : ${(mutationsValue * 100).toFixed(0)}%`
})
sliderContainer.appendChild(text)
sliderContainer.appendChild(slider)

document.body.insertBefore(sliderContainer, document.body.firstChild)

return {getDatabases() {
    const oldData = data
    // reset for each tick
    data = makeCleanData()

    if (oldData != null) {
        const min = Math.min(data.length, oldData.length)
        for (let i = 0; i < min; i++) {
            data[i].lastSample = oldData[i].lastSample
        }
    }
    for (let i = 0; i < data.length; i++) {
        var row = data[i]
        if (row.lastSample == null || Math.random() < mutationsValue) {
            row.lastMutationId = counter++
            row.nbQueries = nbQueries
            const nbQueries = Math.floor((Math.random() * 10) + 1)
            const queries = makeCleanQueryRow()
            updateQueryRow(queries, nbQueries)
            row.lastSample = {
                queries, nbQueries,
                topFiveQueries: queries.slice(0, Math.min(5, nbQueries)),
                countClassName: countClassName(nbQueries),
            }
        } else {
            data[i] = oldData[i]
        }
    }
}}
})()
