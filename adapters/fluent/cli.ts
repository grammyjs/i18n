// i18n CLI capabilities for Fluent adapter.

import { type Expression, parse, type PatternElement } from "@fluent/syntax";
import { parseArgs } from "node:util";
import type {
    AdapterCliConfig,
    GeneratedMessages,
    TypeGenSourceFile,
} from "../types.ts";

export default <AdapterCliConfig> {
    version: 1,
    extensions: [".ftl"],
    features: {
        "type-gen": generateTypes,
    },
};

async function generateTypes(
    sources: AsyncIterable<TypeGenSourceFile>,
    rawArgs: string[],
): Promise<{
    messages: GeneratedMessages;
    additional: string;
}> {
    const args = parseArgs({
        args: rawArgs,
        strict: true,
        options: {
            "allow-override": {
                type: "boolean",
                default: false,
            },
        },
    });

    const messages = new Map<string, {
        source: string;
        placeables: Set<string>;
    }>();

    for await (const { content, namespace, path } of sources) {
        const resource = parse(content, {});

        for (const entry of resource.body) {
            if (entry.type !== "Message")
                continue;

            const messageKey = namespace != null
                ? `${namespace}:${entry.id.name}`
                : entry.id.name;

            if (entry.value != null) {
                const expressions = extractExpressions(entry.value.elements);
                const key = messageKey;
                if (messages.has(key) && !args.values["allow-override"]) {
                    console.error(
                        `duplicate key: '${key}' was already specified in`,
                        messages.get(key)?.source === path
                            ? `the same file before.`
                            : messages.get(key)?.source +
                                ` but ${path} is trying to override.`,
                    );
                    continue;
                }
                messages.set(key, {
                    source: path,
                    placeables: getPlaceables(expressions),
                });
            }

            if (entry.attributes.length > 0) {
                for (const attr of entry.attributes) {
                    const expressions = extractExpressions(attr.value.elements);
                    const key = `${messageKey}.${attr.id.name}`;
                    if (key in messages && !args.values["allow-override"]) {
                        console.error(
                            `duplicate key: '${key}' was already specified in`,
                            messages.get(key)?.source === path
                                ? `the same file before.`
                                : messages.get(key)?.source +
                                    ` but ${path} is trying to override.`,
                        );
                        continue;
                    }
                    messages.set(key, {
                        source: path,
                        placeables: getPlaceables(expressions),
                    });
                }
            }
        }
    }

    const additional = "type Value = string | number | Date;";
    const output: Record<string, Record<string, string>> = {};
    for (const [messageKey, { placeables }] of messages.entries()) {
        const variableMap: Record<string, string> = {};
        for (const placeable of placeables)
            variableMap[placeable] = "Value";
        output[messageKey] = variableMap;
    }

    return {
        messages: output,
        additional: additional,
    };
}

function extractExpressions(elements: PatternElement[]): Expression[] {
    return elements
        .filter((element) => element.type === "Placeable")
        .map((element) => element.expression);
}

function getPlaceables(expressions: Expression[]): Set<string> {
    let placeables = new Set<string>();
    for (const expression of expressions) {
        switch (expression.type) {
            case "FunctionReference": {
                const args = expression.arguments.positional;
                placeables = placeables.union(getPlaceables(args));
                break;
            }
            case "VariableReference": {
                placeables.add(expression.id.name);
                break;
            }
            case "SelectExpression": {
                const selector = expression.selector;
                if (selector.type === "VariableReference")
                    placeables.add(selector.id.name);
                break;
            }
        }
    }
    return placeables;
}
