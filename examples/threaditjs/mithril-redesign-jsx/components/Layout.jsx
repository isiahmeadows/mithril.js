import {m, Use} from "mithril"
import Header from "./Header.jsx"

export default function Layout({load, id, view}) {
    return <>
        <Header />
        <div class="main">
            {m.link(id, <Use init={load} view={(request) => request.match({
                pending: () => <h2>Loading</h2>,
                complete: (v) => [view(v)],
                error: (e) => e.status === 404
                    ? <h2>Not found! Don't try refreshing!</h2>
                    : <h2>Error! Try refreshing.</h2>
            })} />)}
        </div>
    </>
}
