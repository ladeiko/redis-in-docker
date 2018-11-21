const os = require('os');
const tmp = require('tmp');
const path = require('path');
const should = require('should');
const RedisContainer = require('../index'); // tslint:disable-line

tmp.setGracefulCleanup();

describe('redis-in-docker', () => {
  after(() => {
    RedisContainer.cleanup();
  });

  if (process.argv.includes('---wtfnode')) {
    afterEach(() => {
      const wtf = require('wtfnode');
      wtf.dump();
    });
  }

  const testedConfigurations = [
    {
      redisV4: false
    },
    {
      redisV4: true
    },
  ];

  for (const options of testedConfigurations) {
    describe(`using options: ${JSON.stringify(options)}`, () => {
      it(`should start/stop/set/get`, async () => {
        const container = new RedisContainer(options);

        should(container.port).be.undefined();
        should(container.host).be.undefined();

        await container.start();

        should(container.port)
          .be.instanceOf(Number)
          .and.greaterThan(0);
        should(container.host)
          .be.instanceOf(String)
          .and.not.empty();

        const undefinedValue = await container.client().get('HELLO');
        should(undefinedValue).be.null();

        await container.client().set('HELLO', 'WORLD');
        const value = await container.client().get('HELLO');

        should(value).be.exactly('WORLD');

        await container.stop();

        should(container.port).be.undefined();
        should(container.host).be.undefined();
      });

      it(`should use storage`, async () => {

        const tmpOptions: any = {
          unsafeCleanup: true
        };

        if (os.platform() !== 'win32') {
          tmpOptions.template = '/tmp/redis-in-docker-XXXXXXXXXXXXXXXXXX';
        }

        const dir = tmp.dirSync(tmpOptions);
        const dirName = dir.name;

        // CREATE

        const container = new RedisContainer({
          storage: dirName
        });

        await container.start();

        await container.client().set('HELLO', 'WORLD');
        const value = await container.client().get('HELLO');

        should(value).be.exactly('WORLD');

        await container.stop();

        // RESTORE

        const anotherContainer = new RedisContainer({
          storage: dirName
        });

        await anotherContainer.start();

        const restoredValue = await anotherContainer.client().get('HELLO');

        should(restoredValue).be.exactly('WORLD');

        await anotherContainer.stop();

        dir.removeCallback();
      });

    });
  }
});
