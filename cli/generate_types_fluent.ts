import { log } from "./deps.ts";
import {
    type Expression,
    parse,
    type PatternElement,
} from "npm:@fluent/syntax@0.19.0";
import { yellow } from "jsr:@std/fmt@^1/colors";

export default async function (sources: Set<string>) {
    const ALLOW_OVERRIDES = false;
    const messages = new Map<string, {
        source: string;
        placeables: Set<string>;
    }>();
    for (const file of sources) {
        let content: string;
        try {
            content = await Deno.readTextFile(file);
        } catch (err) {
            if (err instanceof Deno.errors.NotFound) {
                sources.delete(file);
                log.info(yellow("stopped watching: file not found"), file);
                continue;
            } else {
                throw err;
            }
        }

        const resource = parse(content, {});

        for (const entry of resource.body) {
            // todo: introduce errors, from parsing, maybe in another cli subcommand?
            if (entry.type !== "Message") continue;

            if (entry.value != null) {
                const expressions = extractExpressions(entry.value.elements);
                const key = entry.id.name;
                if (messages.has(key) && !ALLOW_OVERRIDES) {
                    log.error(
                        `duplicate key: '${key}' was already specified in`,
                        messages.get(key)?.source === file
                            ? `the same file before.`
                            : messages.get(key)?.source +
                                ` but ${file} is trying to override.`,
                    );
                    continue;
                }
                messages.set(key, {
                    source: file,
                    placeables: getPlaceables(expressions),
                });
            }

            if (entry.attributes.length > 0) {
                for (const attr of entry.attributes) {
                    const expressions = extractExpressions(attr.value.elements);
                    const key = `${entry.id.name}.${attr.id.name}`;
                    if (key in messages && !ALLOW_OVERRIDES) {
                        log.error(
                            `duplicate key: '${key}' was already specified in`,
                            messages.get(key)?.source === file
                                ? `the same file before.`
                                : messages.get(key)?.source +
                                    ` but ${file} is trying to override.`,
                        );
                        continue;
                    }
                    messages.set(key, {
                        source: file,
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
        for (const placeable of placeables) {
            variableMap[placeable] = "Value";
        }
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
                if (selector.type === "VariableReference") {
                    placeables.add(selector.id.name);
                }
                break;
            }
        }
    }
    return placeables;
}
