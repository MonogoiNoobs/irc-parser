/**
 * IRCParser
 * @author MonogoiNoobs
 * @license 0BSD
 */

import { Verbs } from "./Verbs.js";
import { Numerics } from "./Numerics.js";

/**
 * This gives you statics, so just use directly like `JSON`:
 * * `IRCParser.parse(str)`
 * * `IRCParser.stringify(obj)`
 * * `IRCParser.mask(maskStr).test(targetSourceStr)`.
 *
 * You can use some useful constants:
 * * `IRCParser.Verbs`
 * * `IRCParser.Numerics.RPL`
 * * `IRCParser.Numerics.ERR`
 */
export class IRCParser {
	static Verbs = Verbs;
	static Numerics = Numerics;

	static #hostRegExp = /^(?:localhost|(?:[12]\d{2}|[1-9]\d|[1-9])(?:\.(?:[12]\d{2}|[1-9]\d|\d)){3}|(?:(?:[^_-].*[^_-]|.)(?:\.[^_-].*[^_-]|\.[^_-])+))$/iu;

	/**
	 * @typedef {{verb: keyof typeof Verbs | typeof Numerics.RPL[keyof typeof Numerics.RPL] | typeof Numerics.ERR[keyof typeof Numerics.ERR], params?: string[], source?: {nick: string, user?: string, host?: string, toString: () => string}, tags?: {string: string}}} IRCObject
	 */

	/** @type {IRCObject} */
	unti = {
		verb: "22222"
	};

	/**
	 * @param {string} arg
	 */
	static #escapeIRCTagComponent(arg) {
		return Array.from(arg).flatMap(v => {
			if (v === "\\") return ["\\", "\\"];
			if (v === " ") return ["\\", "s"];
			if (v === ";") return ["\\", ":"];
			if (v === "\r") return ["\\", "r"];
			if (v === "\n") return ["\\", "n"];
			return v;
		}).join("")
	}

	/**
	 * @param {string} arg
	 */
	static #unescapeIRCTagComponent(arg) {
		const array = Array.from(arg).map(v => [v]);
		for (const [i, v] of array.entries()) {
			if (v[0] === "\\") {
				v[0] =
					i + 1 === array.length ? [] :
						array[i + 1][0] === ":" ? ";" :
							array[i + 1][0] === "s" ? " " :
								array[i + 1][0] === "n" ? "\n" :
									array[i + 1][0] === "r" ? "\r" :
										array[i + 1][0];
				array[i + 1] = [];
			}
		}
		return array.flat().join("");
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
			let onlynick = { nick };
			Object.defineProperty(onlynick, "toString", {
				value() { return nick },
				enumerable: false
			});
			return onlynick;
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
			value() { return arg; },
			enumerable: false
		});

		return result;
	}

	/**
	 * Parses an IRC message.
	 * @param {string} arg IRC message
	 * @returns {IRCObject}
	 * @example
	 * // The message MUST be ended with CR+LF.
	 * const data = IRCParser.parse(":john@example.com PRIVMSG #general :hi guys\r\n");
	 * if (data.verb === IRCParser.Verbs.PRIVMSG)
	 *   console.log(`<${data.source.nick}>: ${data.params.at(-1)}`);
	 *   //"<john>: hi guys"
	 */
	static parse(arg) {
		if (!arg.trim()) return {};

		if (!arg.endsWith("\r\n"))
			throw new Error("Invalid syntax");

		arg = arg.replace(/\r\n$/, "");

		const result = {
			verb: "",
			params: [],
		};

		parsing:
		for (
			let splitted = arg.split(" ")
			, v = splitted.shift()
			, gotVerb = false;
			v !== void 0;
			v = splitted.shift()
		) {
			switch (v[0]) {
				case "@":
					result.tags = this.#parseTags(v.slice(1));
					break;

				case ":":
					if (gotVerb) {
						result.params.push([v, ...splitted].join(" ").slice(1));
						break parsing;
					}
					result.source = this.#parseSource(v.slice(1));
					break;

				default:
					if (!v) break;
					if (gotVerb) {
						result.params.push(v);
						break;
					}
					result.verb = v;
					gotVerb = true;
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
				.map(v => [this.#escapeIRCTagComponent(v[0]), v[1] ? this.#escapeIRCTagComponent(v[1]) : []].flat())
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
					if (v.includes(" ") && v !== obj.params[obj.params.length - 1])
						throw new Error("Invalid params");
					return v === obj.params[obj.params.length - 1] ? `:${v}` : v;
				})
				.join(" ");
		}

		result += "\r\n";

		return result;
	}

	/**
	 * Cooks a Curry only holding the `test(IRCSourceString)` that compares with the mask.
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
