# irc-parser

awful js irc msg parser for my personal use

## list

* passed ircv3 tests
* verbose constants

## example

useful for twitch chat

```js
import { IRCParser } from "./IRCParser.js";

const timefmt = new Intl.DateTimeFormat("ja-JP", { timeStyle: "short" });

const twitch = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
twitch.addEventListener("open", event => {
	event.target.send(IRCParser.stringify({
		verb: IRCParser.Verbs.CAP,
		params: ["REQ", "twitch.tv/tags"],
	}));
	event.target.send(IRCParser.stringify({
		verb: IRCParser.Verbs.NICK,
		params: [`justinfan${Math.trunc(Math.random() * 10000)}`]
	}));
	event.target.send(IRCParser.stringify({
		verb: IRCParser.Verbs.JOIN,
		params: ["#stylishnoob4"],
	}));
});

twitch.addEventListener("message", event => {
	const message = IRCParser.parse(event.data);
	switch (message.verb) {
		case IRCParser.Verbs.PING:
			event.target.send(IRCParser.stringify({
				...message,
				verb: IRCParser.Verbs.PONG,
			}));
			return;
		case IRCParser.Verbs.PRIVMSG:
			console.log(`${timefmt.format(Date.now())} ${Number(message.tags.subscriber) ? "🈵" : ""}${Number(message.tags.mod) ? "⚔" : ""}${message.tags.badges.includes("premium") ? "👑" : ""}${message.tags.badges.includes("bits") ? "💸" : ""}${message.tags["display-name"]}${message.tags["display-name"] === message.source.nick ? "" : ` (${message.source.nick})`}: ${message.params.at(-1)}`);
			return;
		default:
			return;
	}
});
```
