#!/usr/bin/env node
import {env, argv} from "process"
import {BayServer} from "bayserver-core/baykit/bayserver/bayserver"
import {dirname} from "path"

const baseDir = dirname(__filename)
const bsrvModuleDir = dirname(baseDir)
const nodeModuleDir = dirname(bsrvModuleDir)

if (env.BSERV_HOME == null) {
    env.BSERV_HOME = dirname(nodeModuleDir)
}


//console.log(bservHome)

BayServer.main(argv);
