import { IRCParser } from "./IRCParser.js";
import { parse } from "https://deno.land/std/encoding/yaml.ts";
import { assert, assertEquals, assertArrayIncludes } from "https://deno.land/std/testing/asserts.ts";

const getTestData = async path => parse(new TextDecoder().decode(await Deno.readFile(path))).tests;

for (const test of await getTestData("./parser-tests/tests/msg-join.yaml")) {
	Deno.test(`[msg-join] ${test.desc}`, () => {
		assertArrayIncludes(test.matches, [IRCParser.stringify(test.atoms).replace(/\r\n$/, "")]);
	});
}


for (const test of await getTestData("./parser-tests/tests/msg-split.yaml")) {
	Deno.test(`[msg-split] ${test.input}`, () => {
		const data = IRCParser.parse(`${test.input}\r\n`);
		if (Object.hasOwn(data, "source"))
			data.source = data.source.toString();
		assertEquals(data, test.atoms);
	});
}

for (const test of await getTestData("./parser-tests/tests/userhost-split.yaml")) {
	Deno.test(`[userhost-split] ${test.source}`, () => {
		assertEquals(IRCParser.parse(`:${test.source} TEST\r\n`).source, test.atoms);
	});
}


for (const test of await getTestData("./parser-tests/tests/validate-hostname.yaml")) {
	Deno.test(`[validate-hostname] ${test.host}`, () => {
		const isValid = arg => {
			try {
				IRCParser.stringify({
					source: {
						nick: "a",
						host: arg
					},
					verb: "COMMAND",
				});
			} catch (_) {
				return false;
			}
			return true;
		}

		assertEquals(isValid(test.host), test.valid);
	});
}

for (const test of await getTestData("./parser-tests/tests/mask-match.yaml")) {
	Deno.test(`[mask-match] ${test.mask}`, () => {
		const mask = IRCParser.mask(test.mask);
		for (const match of test.matches) assert(mask.test(match));
		for (const fail of test.fails) assert(!mask.test(fail));
	});
}
