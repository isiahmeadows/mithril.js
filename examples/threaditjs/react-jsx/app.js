import {BrowserRouter, Route} from "react-router"
import React from "react"
import ReactDOM from "react-dom"
import Home from "./Home.js"
import Thread from "./Thread.js"

T.time("Setup")

ReactDOM.render(document.getElementById("app"), (
    <BrowserRouter>
        <Route path="/" exact component={Home} />
        <Route path="/thread/:id" component={Thread} />
    </BrowserRouter>
))
