import { useState, useRef } from "react";

const WS_URL = "ws://localhost:8080";

export default function MultiplayerLobbyPage({ onGameStart, onBack }) {
	const [step, setStep] = useState("name"); // name | mode | hosting | joining | waiting
	const [playerName, setPlayerName] = useState("");
	const [mode, setMode] = useState(null); // 'host' | 'join'
	const [roomCodeInput, setRoomCodeInput] = useState("");
	const [roomCode, setRoomCode] = useState(null);
	const [error, setError] = useState(null);
	const [players, setPlayers] = useState([]);
	const wsRef = useRef(null);

	const connect = () => {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(WS_URL);
			ws.onopen = () => resolve(ws);
			ws.onerror = () => reject(new Error("Could not connect to server. Make sure it's running."));
		});
	};

	const handleHost = async () => {
		setError(null);
		try {
			const ws = await connect();
			wsRef.current = ws;

			ws.onmessage = (event) => {
				const msg = JSON.parse(event.data);
				if (msg.type === "room-created") {
					setRoomCode(msg.roomCode);
					setStep("waiting");
				}
				if (msg.type === "player-joined") {
					setPlayers(msg.players);
					// Both players connected — start game
					if (msg.players.length === 2) {
						onGameStart({ ws, players: msg.players, isHost: true, roomCode: msg.players[0]?.roomCode });
					}
				}
				if (msg.type === "player-joined" && msg.players.length === 2) {
					onGameStart({ ws, players: msg.players, isHost: true, roomCode });
				}
			};

			ws.send(JSON.stringify({ type: "create-room", playerName }));
			setMode("host");
		} catch (e) {
			setError(e.message);
		}
	};

	const handleJoin = async () => {
		if (!roomCodeInput.trim()) {
			setError("Enter a room code");
			return;
		}
		setError(null);
		try {
			const ws = await connect();
			wsRef.current = ws;

			ws.onmessage = (event) => {
				const msg = JSON.parse(event.data);
				if (msg.type === "error") {
					setError(msg.message);
					ws.close();
					setStep("joining");
				}
				if (msg.type === "player-joined") {
					setPlayers(msg.players);
					if (msg.players.length === 2) {
						onGameStart({ ws, players: msg.players, isHost: false, roomCode: roomCodeInput.toUpperCase() });
					}
				}
			};

			ws.send(JSON.stringify({ type: "join-room", roomCode: roomCodeInput.toUpperCase(), playerName }));
			setMode("join");
			setStep("joining");
		} catch (e) {
			setError(e.message);
		}
	};

	const copyCode = () => {
		if (roomCode) navigator.clipboard.writeText(roomCode);
	};

	return (
		<div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative">
			<button
				onClick={onBack}
				className="fixed top-6 left-8 text-white/30 text-[10px] tracking-widest uppercase hover:text-white/70 transition-colors duration-300 cursor-pointer"
			>
				← Back
			</button>

			<div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
				<div className="text-center">
					<p className="text-white/30 text-[10px] tracking-widest uppercase mb-3">Pokémon TCG</p>
					<h1 className="text-4xl font-light tracking-wide">Multiplayer</h1>
				</div>

				{/* Step: Enter name */}
				{step === "name" && (
					<div className="flex flex-col gap-4 w-full">
						<input
							type="text"
							placeholder="Your name"
							value={playerName}
							onChange={(e) => setPlayerName(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && playerName.trim() && setStep("mode")}
							maxLength={20}
							className="w-full bg-transparent border border-white/15 text-white text-sm placeholder-white/25 px-5 py-3 rounded-full focus:outline-none focus:border-white/35 tracking-wide transition-colors text-center"
						/>
						<button
							disabled={!playerName.trim()}
							onClick={() => setStep("mode")}
							className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-10 py-3 rounded-full hover:bg-white hover:text-black transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
						>
							Continue
						</button>
					</div>
				)}

				{/* Step: Choose mode */}
				{step === "mode" && (
					<div className="flex flex-col gap-4 w-full">
						<p className="text-white/40 text-xs text-center tracking-wide">
							Playing as <span className="text-white/70">{playerName}</span>
						</p>
						<button
							onClick={handleHost}
							className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-10 py-3 rounded-full hover:bg-white hover:text-black transition-all duration-300 cursor-pointer"
						>
							Host a Room
						</button>
						<button
							onClick={() => setStep("joining")}
							className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-10 py-3 rounded-full hover:bg-white hover:text-black transition-all duration-300 cursor-pointer"
						>
							Join a Room
						</button>
					</div>
				)}

				{/* Step: Waiting as host */}
				{step === "waiting" && roomCode && (
					<div className="flex flex-col items-center gap-6 w-full">
						<p className="text-white/30 text-xs tracking-widest uppercase">Share this code</p>
						<button
							onClick={copyCode}
							className="text-6xl font-light tracking-[0.3em] text-white hover:text-white/70 transition-colors cursor-pointer select-all"
							title="Click to copy"
						>
							{roomCode}
						</button>
						<p className="text-white/20 text-[10px] tracking-widest">click to copy</p>
						<div className="flex items-center gap-2 mt-2">
							<div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" />
							<p className="text-white/30 text-[10px] tracking-widest uppercase">Waiting for opponent...</p>
						</div>
					</div>
				)}

				{/* Step: Join a room */}
				{step === "joining" && (
					<div className="flex flex-col gap-4 w-full">
						<p className="text-white/40 text-xs text-center tracking-wide">
							Playing as <span className="text-white/70">{playerName}</span>
						</p>
						<input
							type="text"
							placeholder="Room code"
							value={roomCodeInput}
							onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
							onKeyDown={(e) => e.key === "Enter" && handleJoin()}
							maxLength={4}
							className="w-full bg-transparent border border-white/15 text-white text-2xl placeholder-white/25 px-5 py-3 rounded-full focus:outline-none focus:border-white/35 tracking-[0.4em] transition-colors text-center uppercase"
						/>
						<button
							onClick={handleJoin}
							className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-10 py-3 rounded-full hover:bg-white hover:text-black transition-all duration-300 cursor-pointer"
						>
							Join
						</button>
						<button
							onClick={() => {
								setStep("mode");
								setError(null);
							}}
							className="text-white/25 text-[10px] tracking-widest uppercase hover:text-white/50 transition-colors cursor-pointer"
						>
							← Back
						</button>
					</div>
				)}

				{error && <p className="text-red-400/70 text-[10px] tracking-widest text-center">{error}</p>}
			</div>
		</div>
	);
}
