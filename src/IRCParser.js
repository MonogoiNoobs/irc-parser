/**
 * IRCParser
 * @author MonogoiNoobs
 * @license SPDX-License-Identifier: MIT
 */

import { Verbs } from "./Verbs.js";
export { Verbs };

import { Numerics } from "./Numerics.js";
export { Numerics };

/**
 * # IRCParser
 *
 * ## Functions
 *
 * ### `IRCParser.parse(str)`
 *
 * Like `JSON.parse(str)`.
 *
 * Note a valid IRC message *shall* end with `"\r\n"`.
 *
 * ### `IRCParser.stringify(obj)`
 *
 * Like `JSON.stringify(obj)`.
 *
 * ### `IRCParser.mask(maskStr).test(targetSourceStr)`
 *
 * (todo)
 *
 * ## Constants
 *
 * ### `Verbs`
 *
 * IRC verbs.
 *
 * ### `Numerics.RPL`
 *
 * IRC non-error-number strings.
 *
 * ### `Numerics.ERR`
 *
 * IRC error-number strings.
 */
export class IRCParser {
	static #hostRegExp = /^(?:localhost|(?:[12]\d{2}|[1-9]\d|[1-9])(?:\.(?:[12]\d{2}|[1-9]\d|\d)){3}|(?:(?:[^\s_-]\S*[^\s_-]|\S)(?:\.[^\s_-]?\S*[^\s_-]?)+))$/iu;

	/**
	 * @typedef {{verb: string, params?: string[], source?: {nick: string, user?: string, host?: string, toString: () => string}, tags?: {string: string}}} IRCObject
	 */

	/**
	 * @param {string} arg
	 */
	static #escapeIRCTagComponent(arg) {
		return Array.from(arg).flatMap(v => {
			switch (v) {
				case "\\": return ["\\", "\\"];
				case " ": return ["\\", "s"];
				case ";": return ["\\", ":"];
				case "\r": return ["\\", "r"];
				case "\n": return ["\\", "n"];
				default: return [v];
			}
		}).join("")
	}

	/**
	 * @param {string} arg
	 */
	static #unescapeIRCTagComponent(arg) {
		const array = Array
			.from(arg)
			.map(v => [v]);

		const unescapeComponent = (i, arr) => {
			if (i + 1 === arr.length) return [];

			switch (arr.at(i + 1).at(0)) {
				case ":": return ";";
				case "s": return " ";
				case "n": return "\n";
				case "r": return "\r";
				default: return arr.at(i + 1).at(0);
			}
		}

		for (const [i, v] of array.entries()) {
			if (v.at(0) !== "\\") continue;
			v[0] = unescapeComponent(i, array);
			array[i + 1] = [];
		}

		return array
			.flat()
			.join("");
	}

	/**
	 * Parse tags.
	 * @param {string} str Tags
	 */
	static #parseTags(str) {
		return Object.fromEntries(str.split(";").map(v => {
			let [key, ...value] = this.#unescapeIRCTagComponent(v).split("=");
			value = value.length
				? value.join("")
				: "";
			return [key, value];
		}));
	}

	static #popDatumAfterDelimiterTo(prop, input, output, delimiter) {
		const delimiterPos = input.indexOf(delimiter);
		if (delimiterPos !== -1) {
			output[prop] = input.slice(delimiterPos + 1);
			input = input.slice(0, delimiterPos);
		}
		return [input, output];
	}

	/**
	 * Parses a source.
	 * @param {string} arg Source
	 */
	static #parseSource(arg) {
		let result = {}
			, nick = arg;

		if (!(nick.includes("!") || nick.includes("@"))) {
			const onlyNick = { nick };
			Object.defineProperty(onlyNick, "toString", {
				value: () => nick,
				enumerable: false
			});
			return onlyNick;
		}

		[nick, result] = this.#popDatumAfterDelimiterTo("host", nick, result, "@");
		[nick, result] = this.#popDatumAfterDelimiterTo("user", nick, result, "!");

		if (Object.hasOwn(result, "host") && !this.#hostRegExp.test(result.host))
			throw new TypeError("Invalid host");

		result = {
			nick,
			...result
		};

		Object.defineProperty(result, "toString", {
			value: () => arg,
			enumerable: false
		});

		return result;
	}

	/**
	 * Parses an IRC message.
	 * @param {string} arg IRC message
	 * @returns {IRCObject} IRC object
	 * @example
	 * // The message SHALL end with CR+LF.
	 * const data = IRCParser.parse(":john@example.com PRIVMSG #general :hi guys\r\n");
	 * if (data.verb === IRCParser.Verbs.PRIVMSG)
	 *   console.log(`<${data.source.nick}>: ${data.params.at(-1)}`);
	 *   //=> "<john>: hi guys"
	 */
	static parse(arg) {
		if (!arg.trim()) return {};

		if (!arg.endsWith("\r\n"))
			throw new Error("Invalid syntax");

		arg = arg.replace(/\r\n$/u, "");

		const result = {
			verb: "",
			params: [],
		};

		parsing:
		for (
			let split = arg.split(" "), v = split.shift(), hasGotVerb = false;
			v !== void 0;
			v = split.shift()
		) {
			switch (v.at(0)) {
				case "@":
					result.tags = this.#parseTags(v.slice(1));
					break;

				case ":":
					if (hasGotVerb) {
						result.params.push([v, ...split].join(" ").slice(1));
						break parsing;
					}
					result.source = this.#parseSource(v.slice(1));
					break;

				default:
					if (!v) break;
					if (hasGotVerb) {
						result.params.push(v);
						break;
					}
					result.verb = v;
					hasGotVerb = true;
					break;
			}
		}

		if (!result.params.length) delete result.params;

		return result;
	}

	/**
	 * Builds an IRC message from a valid IRC object JSON.
	 * @param {IRCObject} obj A valid IRC object JSON.
	 * @example
	 * const ws = new WebSocket("wss://irc.example.net:1234");
	 * ws.addEventListener("message", event => {
	 *   const received = IRCParser.parse(event.data);
	 *   switch (received.verb) {
	 *     case IRCParser.Verbs.PING:
	 *       event.target.send(IRCParser.stringify({
	 *         ...received,
	 *         verb: IRCParser.Verbs.PONG,
	 *       }));
	 *       break;
	 *   default:
	 *     throw new Error("Unknown verb received");
	 *   }
	 * });
	 */
	static stringify(obj) {
		let result = "";

		if (Object.hasOwn(obj, "tags") && Object.keys(obj.tags).length) {
			result += "@";
			result += Object
				.entries(obj.tags)
				.map(v => [this.#escapeIRCTagComponent(v.at(0)), v.at(1) ? this.#escapeIRCTagComponent(v.at(1)) : []].flat())
				.map(v => v.join("="))
				.join(";");
			result += " ";
		}

		if (Object.hasOwn(obj, "source")) {
			result += ":";

			if (typeof obj.source === "string") {
				result += obj.source;
			} else {
				result += Object.hasOwn(obj.source, "nick") ? obj.source.nick : "";
				result += Object.hasOwn(obj.source, "user") ? "!" + obj.source.user : "";
				result += Object.hasOwn(obj.source, "host") ? "@" + obj.source.host : "";
				if (Object.hasOwn(obj.source, "host") && !this.#hostRegExp.test(obj.source.host))
					throw new TypeError("Invalid host");
			}

			result += " ";
		}

		result += `${obj.verb}`;

		if (Object.hasOwn(obj, "params")) {
			result += " ";
			result += obj
				.params
				.map(v => {
					if (v.includes(" ") && v !== obj.params.at(obj.params.length - 1))
						throw new Error("Invalid params");
					return v === obj.params.at(obj.params.length - 1) ? `:${v}` : v;
				})
				.join(" ");
		}

		return result + "\r\n";
	}

	/**
	 * Cooks a curry only holding the `test(IRCSourceString)` that compares with the mask.
	 * @param {string} maskSource An IRC source mask.
	 * @example
	 * const mask = IRCParser.mask("gr?y!?@*");
	 * console.assert(mask.test("gray!~@example.net"));
	 * console.assert(mask.test("grey!#@adm.example.net"));
	 */
	static mask(maskSource) {
		return {
			/**
			 * Compares with the mask.
			 * @param {string} source An IRC source string you want to compare
			 */
			test(source) {
				return new RegExp(`^${maskSource.replaceAll(/([\[\]!])/ug, "\\$&").replaceAll(/\*/ug, ".*").replaceAll(/\?/ug, ".")}$`).test(source);
			}
		};
	}
}
