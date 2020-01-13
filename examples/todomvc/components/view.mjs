import {m} from "mithril"
import Footer from "./footer.mjs"
import Header from "./header.mjs"
import TodoList from "./todo-list.mjs"
import * as Model from "../model.mjs"

export default function View({model, showing}) {
    return [
        m(Header),
        Model.todoCount(model) > 0 && [
            m(TodoList, {model, showing}),
            m(Footer, {model, showing}),
        ],
    ]
}
