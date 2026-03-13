type MaybePromise<T> = T | Promise<T>;

interface AdapterCliConfigV1 {
    version: 1;
    extensions: [string, ...string[]];
    features: Partial<{
        "type-gen": (sources: Set<string>) => MaybePromise<{
            messages: Record<string, Record<string, string>>;
            additional: string | null;
        }>;
        // "check": // todo: error checking from parsing
        // "sync-check": // todo: check for message equality across locales
    }>;
}

export type AdapterCliConfig = AdapterCliConfigV1;
