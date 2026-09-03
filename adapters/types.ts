type MaybePromise<T> = T | Promise<T>;

export type TypeGenSourceFile = {
    path: string;
    namespace: string | undefined;
    content: string;
};

export type GeneratedMessages = Record<
    string, // message
    Record<string, string> // variable: type
>;

interface AdapterCliConfigV1 {
    /** Version of the adapter configuration. */
    version: 1;
    /** File extensions associated with the adapter, to be read by the CLI. */
    extensions: string[];
    /** Features available in the adapter configuration. */
    features: Partial<{
        /**
         * **TypeScript Types Generation**
         * // todo: update
         * Exposes the adapter's ability to generate types from a given set of
         * filepaths. This adapter feature shall take in paths to the source
         * files and return a record of messages & variables and any additional
         * raw TypeScript text that is required for making the types work.
         */
        "type-gen": (
            sources: AsyncIterable<TypeGenSourceFile>,
            rawArgs: string[],
        ) => MaybePromise<{
            messages: GeneratedMessages;
            namespaces: Set<string>;
            additional: string | null;
        }>;
        // Additional "fun" features that could be added in the future:
        // * "check": error checking from parsing
        // * "sync-check": check for message equality across locales
        // * "cleaner": unused messages finder across source code (obviously difficult)
    }>;
}

/** Configuration for the adapter's CLI capabilities. */
export type AdapterCliConfig = AdapterCliConfigV1;
