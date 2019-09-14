(function () {
"use strict"

let renderStage = 0
perfMonitor.startFPSMonitor()
perfMonitor.startMemMonitor()
perfMonitor.initProfiler("render")

class AppComponent {
    constructor() {
        this.databases = []
        this.update()
    }

    update() {
        requestAnimationFrame(() => { this.update() })

        this.databases = ENV.getDatabases()

        if (renderStage === 0) {
            renderStage = 1
            perfMonitor.startProfile("render")
        }
    }

    ngAfterViewChecked() {
        if (renderStage === 1) {
            perfMonitor.endProfile("render")
            renderStage = 0
        }
    }
}

AppComponent.annotations = [new ng.core.Component({
    directives: [ng.common.CORE_DIRECTIVES],
    template: `
    <div>
        <table class='table table-striped latest-data'>
            <tbody>
                <tr *ngFor='let db of databases'>
                    <td class='dbname'>{{db.dbname}}</td>
                    <td class='query-count'>
                        <span [class]='db.lastSample.countClassName'>
                            {{db.lastSample.nbQueries}}
                        </span>
                    </td>
                    <td
                        *ngFor='let q of db.lastSample.topFiveQueries'
                        [class]='q.elapsedClassName'
                    >
                        {{q.formatElapsed}}
                        <div class='popover left'>
                            <div class='popover-content'>{{q.query}}</div>
                            <div class='arrow'></div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    `
})]

document.addEventListener("DOMContentLoaded", function() {
    ng.core.enableProdMode()
    ng.platform.browser.bootstrap(AppComponent)
})
})()
