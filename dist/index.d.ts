interface IRedisInDockerOptions {
    redisV4?: boolean;
    verbose?: boolean;
    storage?: string;
}
declare class RedisContainer {
    static cleanup(): void;
    private static readonly prefix;
    private readonly _options;
    private readonly _dockerFileName;
    private readonly _dockerFileHash;
    private readonly _dockerImageName;
    private readonly _dockerContainerName;
    private _runtimeOptions;
    private _runtime;
    private _redis;
    constructor(options?: IRedisInDockerOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    client(): any;
    readonly port: number | undefined;
    readonly host: string | undefined;
    private _validateOptions;
    private _stopContainer;
    private startContainer;
}
export = RedisContainer;
