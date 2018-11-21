# redis-in-docker

## Purpose

Module starts redis server inside docker container. This is helpful while testing.

## Installation

NOTE: Docker required.

```
npm i redis-in-docker --save
```

## Usage

### IRedisInDockerOptions options

```
interface IRedisInDockerOptions {

  // use redis v4, by default v5 is used [optional]
  redisV4?: boolean;

  // if true, all actions will be logged to console, default is false [optional]
  verbose?: boolean;

  // if specified, then it will be used to store redis database after shutdown
  // note: should be accessible by docker
  storage?: string;
}
```

### Methods

#### constructor(options?: IRedisInDockerOptions)
Constructor

#### start()

Starts docker container with redis server.
If succeeded, then ```port```, ```host```, etc. properties become available.

#### stop()
Stops running docker container.
After completion all ```port```, ```host```, etc. properties become unavailable.

#### client() => IORedis

Returns redis client.

### Properties

#### host: string | undefined

Returns domain or ip of running redis server.

#### port: number | undefined

Returns port redis server is listening to.

### Example

```
const RedisContainer  = require('redis-in-docker');

async function main() {
  const options = {
    // See IRedisInDockerOptions
  };

  // instantiate
  const container = new RedisContainer(options);

  // boot
  await container.start();

  const port = container.port;
  const host = container.host;

  // do some work
  ...

  // shutdown
  await container.stop();
}

```

or if you want to use storage:

```
const RedisContainer  = require('redis-in-docker');

async function main() {
  const options = {
    // See IRedisInDockerOptions

    storage: '/my-path'
  };

  // instantiate
  const container = new RedisContainer(options);

  // boot
  await container.start();

  const port = container.port;
  const host = container.host;

  // do some work
  ...

  // shutdown
  await container.stop();

  // Restore after some from the same storage
  await container.start();

  // Work with restored database
  ...

  // shutdown again
  await container.stop();
}

```

## License

MIT. See [LICENSE](LICENSE)

## Author

Siarhei Ladzeika <sergey.ladeiko@gmail.com>
