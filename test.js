/**
 * IRCParser tests
 * @author MonogoiNoobs
 * @license SPDX-License-Identifier: MIT
 */

import { IRCParser } from "./src/IRCParser.js";
import { parse } from "@std/yaml";
import { assert, assertEquals, assertArrayIncludes } from "@std/assert";

const getTestData = async path => parse(new TextDecoder().decode(await Deno.readFile(path))).tests;

Deno.test("stringify() succeeds", async (t) => {
	for (const test of await getTestData("./parser-tests/tests/msg-join.yaml"))
		await t.step(test.desc, () => assertArrayIncludes(test.matches, [IRCParser.stringify(test.atoms).replace(/\r\n$/, "")]));
});

Deno.test("parse() succeeds", async (t) => {
	for (const test of await getTestData("./parser-tests/tests/msg-split.yaml")) {
		await t.step(test.input, () => {
			const data = IRCParser.parse(`${test.input}\r\n`);
			if (Object.hasOwn(data, "source"))
				data.source = data.source.toString();
			assertEquals(data, test.atoms);
		});
	}
});

Deno.test("Parsing user data succeeds", async (t) => {
	for (const test of await getTestData("./parser-tests/tests/userhost-split.yaml"))
		await t.step(test.source, () => assertEquals(IRCParser.parse(`:${test.source} TEST\r\n`).source, test.atoms));
});

Deno.test("Validating hostnames succeeds", async (t) => {
	for (const test of await getTestData("./parser-tests/tests/validate-hostname.yaml"))
		await t.step(test.host, () => {
			const isValid = arg => {
				try {
					IRCParser.stringify({
						source: {
							nick: "a",
							host: arg
						},
						verb: "COMMAND",
					});
				} catch {
					return false;
				}
				return true;
			}

			assertEquals(isValid(test.host), test.valid);
		});
});

Deno.test("Generating masks succeeds", async (t) => {
	for (const test of await getTestData("./parser-tests/tests/mask-match.yaml"))
		await t.step(test.mask, () => {
			const mask = IRCParser.mask(test.mask);
			for (const match of test.matches) assert(mask.test(match));
			for (const fail of test.fails) assert(!mask.test(fail));
		});
});
