const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const Redis = require('ioredis'); // tslint:disable-line
const _ = require('lodash');
const nodeCleanup = require('node-cleanup');
const { execSync } = require('child_process');

interface IRedisInDockerOptions {
  redisV4?: boolean;
  verbose?: boolean;
  storage?: string;
}

const runningContainers: string[] = [];

function cleanup() {
  _.each(runningContainers, value => {
    try {
      execSync(`docker stop ${value}`);
    } catch (e) {
      /* ignore */
    }
  });
  _.remove(runningContainers);
}

nodeCleanup((/*exitCode, signal*/) => {
  cleanup();
});

async function run(options: any) {
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
      } else {
        reject(code);
      }
    });
  });
}

async function generateFreePort() {
  while (true) {
    const port = Math.ceil(Math.random() * 20000 + 45000);
    try {
      await run({ cmd: 'nc', args: ['-z', '127.0.0.1', port] });
    } catch (e) {
      return port;
    }
  }
}

function rndStr() {
  return crypto.randomBytes(16).toString('hex');
}

class RedisContainer {
  public static cleanup() {
    cleanup();
  }

  private static readonly prefix = 'redis-in-docker-';
  private readonly _options: IRedisInDockerOptions;
  private readonly _dockerFileName: string;
  private readonly _dockerFileHash: string;
  private readonly _dockerImageName: string;
  private readonly _dockerContainerName: string;
  private _runtimeOptions: any;
  private _runtime: any = {};
  private _redis: any;

  constructor(options?: IRedisInDockerOptions) {
    this._options = options || {};
    this._validateOptions();
    if (this._options.redisV4) {
      this._dockerFileName = 'Dockerfile4';
    } else {
      this._dockerFileName = 'Dockerfile5';
    }
    this._dockerFileHash = crypto
      .createHash('md5')
      .update(
        fs.readFileSync(__dirname + '/' + this._dockerFileName, {
          encoding: 'utf8'
        })
      )
      .digest('hex');
    this._dockerImageName = RedisContainer.prefix + this._dockerFileHash;
    this._dockerContainerName = RedisContainer.prefix + this._dockerFileHash + rndStr();
    this._runtimeOptions = {
      host: '127.0.0.1'
    };
  }

  public async start() {
    if (!_.isEmpty(this._runtime)) {
      throw new Error('Already running');
    }

    const port = await this.startContainer();

    this._runtime = {
      port: port,
      host: this._runtimeOptions.host,
    };

    this._redis = new Redis({
      port: this._runtime.port,
      host: this._runtime.host,
      lazyConnect: true
    });

    await this._redis.connect();
  }

  public async stop() {
    if (_.isEmpty(this._runtime)) {
      return;
    }
    if (this._redis) {
      await this._redis.quit();
      this._redis = null;
    }
    await this._stopContainer();
    _.pull(runningContainers, this._dockerContainerName);
    this._runtime = {};
  }

  public client() {
    return this._redis;
  }

  public get port(): number | undefined {
    return this._runtime.port;
  }

  public get host(): string | undefined {
    return this._runtime.host;
  }

  private _validateOptions() {
    // TODO
  }

  private async _stopContainer() {
    try {
      await run({ cmd: 'docker', args: ['stop', this._dockerContainerName] });
    } catch (e) {
      // empty
    }
    try {
      await run({ cmd: 'docker', args: ['rm', this._dockerContainerName] });
    } catch (e) {
      // empty
    }
  }

  private async startContainer() {
    const port = await generateFreePort();

    await run({
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

    await run({
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
        .concat(
          _.chain(volumes)
            .map(value => ['--mount', `type=bind,source=${value[0]},target=${value[1]}`])
            .flatten()
            .value()
        )
        .concat([this._dockerImageName])
        .concat(cmdOptions)
    });

    runningContainers.push(this._dockerContainerName);

    await run({
      verbose: this._options.verbose,
      cmd: 'docker',
      args: ['exec', this._dockerContainerName, '/bin/bash', '-c', 'until nc -z 127.0.0.1 6379; do sleep 1; done; echo "";']
    });

    return port;
  }
}

export = RedisContainer;

