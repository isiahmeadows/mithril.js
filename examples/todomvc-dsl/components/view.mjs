import {m, component} from "mithril"
import {Footer} from "./footer.mjs"
import {Header} from "./header.mjs"
import {TodoList} from "./todo-list.mjs"
import * as Model from "../model.mjs"

export const View = component(({model, showing}) => [
    m(Header),
    Model.todoCount(model) > 0 && [
        m(TodoList, {model, showing}),
        m(Footer, {model, showing}),
    ],
])
