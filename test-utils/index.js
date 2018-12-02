"use strict"

// Ospec
var o = require("./ospec/ospec")

// Modules
var mountService = require("../api/mount")
var redrawService = require("../api/redraw")
var routerService = require("../api/router")
var hyperscript = require("../render/hyperscript")
var render = require("../render/render")
var trust = require("../render/trust")
var fragment = require("../render/fragment")
var vnode = require("../render/vnode")
var coreRouter = require("../router/router")
var requestService = require("../request/request")
var PromisePolyfill = require("../promise/promise")
var parseQueryString = require("../querystring/parse")
var buildQueryString = require("../querystring/build")

// Utils
var browserMock = require("./browserMock")
var callAsync = require("./callAsync")
var components = require("./components")
var domMock = require("./domMock")
var parseURL = require("./parseURL")
var pushStateMock = require("./pushStateMock")
var throttleMock = require("./throttleMock")
var xhrMock = require("./xhrMock")

// Installation
var global = Function("return this")()

global.o = o

global.modules = {
	"api/mount": mountService,
	"api/redraw": redrawService,
	"api/router": routerService,
	"render/hyperscript": hyperscript,
	"render/render": render,
	"render/trust": trust,
	"render/fragment": fragment,
	"render/vnode": vnode,
	"router/router": coreRouter,
	"request/request": requestService,
	"promise/promise": PromisePolyfill,
	"querystring/parse": parseQueryString,
	"querystring/build": buildQueryString,
}

global.utils = {
	browserMock: browserMock,
	callAsync: callAsync,
	components: components,
	domMock: domMock,
	parseURL: parseURL,
	pushStateMock: pushStateMock,
	throttleMock: throttleMock,
	xhrMock: xhrMock,
}
