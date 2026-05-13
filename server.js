import { WebSocketServer } from "ws";

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });
const rooms = new Map();

function generateRoomCode() {
	return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function send(ws, message) {
	if (ws.readyState === 1) ws.send(JSON.stringify(message));
}

function broadcast(room, message) {
	room.players.forEach((p) => send(p.ws, message));
}

wss.on("connection", (ws) => {
	let roomCode = null;
	let playerId = null;

	ws.on("message", (data) => {
		let message;
		try {
			message = JSON.parse(data.toString());
		} catch {
			return;
		}

		const room = rooms.get(roomCode);

		switch (message.type) {
			case "create-room": {
				const code = generateRoomCode();
				roomCode = code;
				playerId = "host";
				rooms.set(code, {
					code,
					players: [{ id: "host", name: message.playerName, ws, score: 0, guess: null }],
					card1: null,
					card2: null,
					state: "waiting",
				});
				send(ws, { type: "room-created", roomCode: code });
				break;
			}

			case "join-room": {
				const r = rooms.get(message.roomCode);
				if (!r) {
					send(ws, { type: "error", message: "Room not found" });
					return;
				}
				if (r.players.length >= 2) {
					send(ws, { type: "error", message: "Room is full" });
					return;
				}
				roomCode = message.roomCode;
				playerId = "guest";
				r.players.push({ id: "guest", name: message.playerName, ws, score: 0, guess: null });
				broadcast(r, {
					type: "player-joined",
					players: r.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
				});
				break;
			}

			case "set-cards": {
				if (!room || playerId !== "host") return;
				room.card1 = message.card1;
				room.card2 = message.card2;
				room.state = "playing";
				room.players.forEach((p) => (p.guess = null));
				broadcast(room, { type: "new-round", card1: message.card1, card2: message.card2 });
				break;
			}

			case "guess": {
				if (!room || room.state !== "playing") return;
				const player = room.players.find((p) => p.id === playerId);
				if (!player || player.guess !== null) return;
				player.guess = message.guess;

				broadcast(room, { type: "player-guessed", playerId });

				if (room.players.every((p) => p.guess !== null)) {
					room.state = "revealing";
					const price1 = room.card1.cardmarket.prices.averageSellPrice;
					const price2 = room.card2.cardmarket.prices.averageSellPrice;
					room.players.forEach((p) => {
						const correct = p.guess === "more" ? price2 > price1 : price2 < price1;
						if (correct) p.score++;
					});
					broadcast(room, {
						type: "round-result",
						guesses: room.players.map((p) => ({ id: p.id, name: p.name, guess: p.guess })),
						scores: room.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
						price1,
						price2,
					});
				}
				break;
			}
		}
	});

	ws.on("close", () => {
		const r = rooms.get(roomCode);
		if (!r) return;
		r.players = r.players.filter((p) => p.id !== playerId);
		if (r.players.length === 0) {
			rooms.delete(roomCode);
		} else {
			broadcast(r, { type: "player-left", playerId });
		}
	});
});

console.log(`WebSocket server running on ws://localhost:${PORT}`);
