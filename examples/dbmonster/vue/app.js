(function () {
"use strict"

let renderStage = 0
perfMonitor.startFPSMonitor()
perfMonitor.startMemMonitor()
perfMonitor.initProfiler("render")

const vm = new Vue({
	el: "#app",
	data: {
		databases: [],
	},
	methods: {
		update() {
			requestAnimationFrame(() => { this.update() })
			this.databases = ENV.generateData()

			if (renderStage === 0) {
				renderStage = 1
				perfMonitor.startProfile("render")
			}
		},
	},
	updated() {
		if (renderStage === 1) {
			renderStage = 0
			perfMonitor.endProfile("render")
		}
	},
})

vm.update()
})()
