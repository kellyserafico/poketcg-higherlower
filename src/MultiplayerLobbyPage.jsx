import { useState, useRef } from "react";
import Peer from "peerjs";

function makeRoomCode() {
	return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function MultiplayerLobbyPage({ onGameStart, onBack }) {
	const [step, setStep] = useState("name"); // name | mode | waiting | joining
	const [playerName, setPlayerName] = useState("");
	const [roomCode, setRoomCode] = useState(null);
	const [roomCodeInput, setRoomCodeInput] = useState("");
	const [error, setError] = useState(null);
	const [connecting, setConnecting] = useState(false);
	const peerRef = useRef(null);

	const handleHost = () => {
		setError(null);
		const code = makeRoomCode();
		const peer = new Peer(code);
		peerRef.current = peer;

		peer.on("open", (id) => {
			setRoomCode(id);
			setStep("waiting");
		});

		peer.on("connection", (conn) => {
			conn.on("open", () => {
				conn.send({ type: "welcome", hostName: playerName });
			});
			conn.on("data", (data) => {
				if (data.type === "guest-ready") {
					onGameStart({ peer, conn, isHost: true, myName: playerName, opponentName: data.guestName, roomCode });
				}
			});
			conn.on("error", () => setError("Connection error. Try again."));
		});

		peer.on("error", (err) => {
			if (err.type === "unavailable-id") {
				// Code collision — retry with a new code
				peer.destroy();
				handleHost();
			} else {
				setError("Could not create room. Check your connection.");
			}
		});
	};

	const handleJoin = () => {
		if (!roomCodeInput.trim()) {
			setError("Enter a room code");
			return;
		}
		setError(null);
		setConnecting(true);
		const peer = new Peer();
		peerRef.current = peer;

		peer.on("open", () => {
			const conn = peer.connect(roomCodeInput.trim().toUpperCase());

			conn.on("open", () => {});

			conn.on("data", (data) => {
				if (data.type === "welcome") {
					conn.send({ type: "guest-ready", guestName: playerName });
					onGameStart({
						peer,
						conn,
						isHost: false,
						myName: playerName,
						opponentName: data.hostName,
						roomCode: roomCodeInput.trim().toUpperCase(),
					});
				}
			});

			conn.on("error", () => {
				setError("Room not found. Check the code.");
				setConnecting(false);
				peer.destroy();
			});

			// Timeout if no response in 8s
			setTimeout(() => {
				if (conn.open === false) {
					setError("Room not found. Check the code.");
					setConnecting(false);
					peer.destroy();
				}
			}, 8000);
		});

		peer.on("error", () => {
			setError("Could not connect. Check your connection.");
			setConnecting(false);
		});
	};

	const copyCode = () => {
		if (roomCode) navigator.clipboard.writeText(roomCode);
	};

	return (
		<div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative">
			<button
				onClick={() => {
					peerRef.current?.destroy();
					onBack();
				}}
				className="fixed top-6 left-8 text-white/30 text-[10px] tracking-widest uppercase hover:text-white/70 transition-colors duration-300 cursor-pointer"
			>
				← Back
			</button>

			<div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
				<div className="text-center">
					<p className="text-white/30 text-[10px] tracking-widest uppercase mb-3">Pokémon TCG</p>
					<h1 className="text-4xl font-light tracking-wide">Multiplayer</h1>
				</div>

				{/* Step: name */}
				{step === "name" && (
					<div className="flex flex-col gap-4 w-full">
						<input
							type="text"
							placeholder="Your name"
							value={playerName}
							onChange={(e) => setPlayerName(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && playerName.trim() && setStep("mode")}
							maxLength={20}
							autoFocus
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

				{/* Step: mode */}
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

				{/* Step: waiting (host) */}
				{step === "waiting" && roomCode && (
					<div className="flex flex-col items-center gap-6 w-full">
						<p className="text-white/30 text-[10px] tracking-widest uppercase">Share this code</p>
						<button
							onClick={copyCode}
							title="Click to copy"
							className="text-5xl font-light tracking-[0.3em] text-white hover:text-white/70 transition-colors cursor-pointer select-all"
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

				{/* Step: join */}
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
							onKeyDown={(e) => e.key === "Enter" && !connecting && handleJoin()}
							maxLength={10}
							autoFocus
							className="w-full bg-transparent border border-white/15 text-white text-xl placeholder-white/25 px-5 py-3 rounded-full focus:outline-none focus:border-white/35 tracking-[0.2em] transition-colors text-center uppercase"
						/>
						<button
							onClick={handleJoin}
							disabled={connecting}
							className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-10 py-3 rounded-full hover:bg-white hover:text-black transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{connecting ? "Connecting..." : "Join"}
						</button>
						<button
							onClick={() => {
								setStep("mode");
								setError(null);
								setConnecting(false);
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
