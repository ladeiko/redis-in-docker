"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const Redis = require('ioredis');
const _ = require('lodash');
const nodeCleanup = require('node-cleanup');
const { execSync } = require('child_process');
const runningContainers = [];
function cleanup() {
    _.each(runningContainers, value => {
        try {
            execSync(`docker stop ${value}`);
        }
        catch (e) {
        }
    });
    _.remove(runningContainers);
}
nodeCleanup(() => {
    cleanup();
});
function run(options) {
    return __awaiter(this, arguments, void 0, function* () {
        const cmd = options.cmd;
        const args = _.castArray(options.args || []);
        const cwd = options.cwd;
        const verbose = options.verbose || false;
        if (!cmd) {
            throw new Error('No command specified');
        }
        if (verbose) {
            console.log('run', arguments);
        }
        return new Promise((resolve, reject) => {
            const child = spawn(cmd, args, { detached: false, cwd: cwd });
            let stdout = '';
            child.stdout.on('data', data => {
                const s = data.toString();
                stdout += s;
                if (verbose) {
                    process.stdout.write(s);
                }
            });
            child.stderr.on('data', data => {
                const s = data.toString();
                stdout += s;
                if (verbose) {
                    process.stderr.write(s);
                }
            });
            child.on('close', code => {
                if (code === 0) {
                    resolve(stdout);
                }
                else {
                    reject(code);
                }
            });
        });
    });
}
function generateFreePort() {
    return __awaiter(this, void 0, void 0, function* () {
        while (true) {
            const port = Math.ceil(Math.random() * 20000 + 45000);
            try {
                yield run({ cmd: 'nc', args: ['-z', '127.0.0.1', port] });
            }
            catch (e) {
                return port;
            }
        }
    });
}
function rndStr() {
    return crypto.randomBytes(16).toString('hex');
}
class RedisContainer {
    constructor(options) {
        this._runtime = {};
        this._options = options || {};
        this._validateOptions();
        if (this._options.redisV4) {
            this._dockerFileName = 'Dockerfile4';
        }
        else {
            this._dockerFileName = 'Dockerfile5';
        }
        this._dockerFileHash = crypto
            .createHash('md5')
            .update(fs.readFileSync(__dirname + '/' + this._dockerFileName, {
            encoding: 'utf8'
        }))
            .digest('hex');
        this._dockerImageName = RedisContainer.prefix + this._dockerFileHash;
        this._dockerContainerName = RedisContainer.prefix + this._dockerFileHash + rndStr();
        this._runtimeOptions = {
            host: '127.0.0.1'
        };
    }
    static cleanup() {
        cleanup();
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!_.isEmpty(this._runtime)) {
                throw new Error('Already running');
            }
            const port = yield this.startContainer();
            this._runtime = {
                port: port,
                host: this._runtimeOptions.host,
            };
            this._redis = new Redis({
                port: this._runtime.port,
                host: this._runtime.host,
                lazyConnect: true
            });
            yield this._redis.connect();
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            if (_.isEmpty(this._runtime)) {
                return;
            }
            if (this._redis) {
                yield this._redis.quit();
                this._redis = null;
            }
            yield this._stopContainer();
            _.pull(runningContainers, this._dockerContainerName);
            this._runtime = {};
        });
    }
    client() {
        return this._redis;
    }
    get port() {
        return this._runtime.port;
    }
    get host() {
        return this._runtime.host;
    }
    _validateOptions() {
    }
    _stopContainer() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield run({ cmd: 'docker', args: ['stop', this._dockerContainerName] });
            }
            catch (e) {
            }
            try {
                yield run({ cmd: 'docker', args: ['rm', this._dockerContainerName] });
            }
            catch (e) {
            }
        });
    }
    startContainer() {
        return __awaiter(this, void 0, void 0, function* () {
            const port = yield generateFreePort();
            yield run({
                verbose: this._options.verbose,
                cmd: 'docker',
                args: ['build', '-f', this._dockerFileName, '-t', this._dockerImageName, '.'],
                cwd: __dirname
            });
            const cmdOptions = [];
            const volumes = [];
            if (this._options.storage) {
                const stat = fs.statSync(this._options.storage);
                if (!stat.isDirectory()) {
                    throw new Error(`${this._options.storage} is not directory`);
                }
                volumes.push([path.normalize(this._options.storage), '/data']);
                cmdOptions.push('redis-server');
                cmdOptions.push('--appendonly');
                cmdOptions.push('yes');
            }
            yield run({
                verbose: this._options.verbose,
                cmd: 'docker',
                args: [
                    'run',
                    '-d',
                    '--rm',
                    '--name',
                    this._dockerContainerName,
                    '-p',
                    `127.0.0.1:${port}:6379/tcp`
                ]
                    .concat(_.chain(volumes)
                    .map(value => ['--mount', `type=bind,source=${value[0]},target=${value[1]}`])
                    .flatten()
                    .value())
                    .concat([this._dockerImageName])
                    .concat(cmdOptions)
            });
            runningContainers.push(this._dockerContainerName);
            yield run({
                verbose: this._options.verbose,
                cmd: 'docker',
                args: ['exec', this._dockerContainerName, '/bin/bash', '-c', 'until nc -z 127.0.0.1 6379; do sleep 1; done; echo "";']
            });
            return port;
        });
    }
}
RedisContainer.prefix = 'redis-in-docker-';
module.exports = RedisContainer;
//# sourceMappingURL=index.js.map