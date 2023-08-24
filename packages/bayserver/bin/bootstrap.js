#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var process_1 = require("process");
var bayserver_1 = require("bayserver-core/baykit/bayserver/bayserver");
var path_1 = require("path");
var baseDir = (0, path_1.dirname)(__filename);
var bsrvModuleDir = (0, path_1.dirname)(baseDir);
var nodeModuleDir = (0, path_1.dirname)(bsrvModuleDir);
if (process_1.env.BSERV_HOME == null) {
    process_1.env.BSERV_HOME = (0, path_1.dirname)(nodeModuleDir);
}
//console.log(bservHome)
bayserver_1.BayServer.main(process_1.argv);
//# sourceMappingURL=bootstrap.js.map