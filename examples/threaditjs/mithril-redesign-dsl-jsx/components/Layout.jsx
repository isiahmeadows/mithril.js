import {m, component, state, use} from "mithril"
import {Header} from "./Header.jsx"

export const Layout = component(({load, id, view}) => <>
    <Header />
    <div class="main">
        {use(id, load).match({
            pending: () => <h2>Loading</h2>,
            complete: (data) => state(() => view(data)),
            error: (e) => e.status === 404
                ? <h2>Not found! Don't try refreshing!</h2>
                : <h2>Error! Try refreshing.</h2>
        })}
    </div>
</>)
