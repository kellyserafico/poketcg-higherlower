import { useState, useEffect, useRef } from "react";
import Peer from "peerjs";

function makeRoomCode() {
	return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function MultiplayerLobbyPage({ onGameStart, onBack }) {
	const hasRoomInUrl = !!new URLSearchParams(window.location.search).get("room");
	const [step, setStep] = useState("name"); // name | mode | set-select | waiting | joining | lobby
	const [playerName, setPlayerName] = useState("");
	const [roomCode, setRoomCode] = useState(null);
	const roomCodeRef = useRef(null);
	const [roomCodeInput, setRoomCodeInput] = useState(() => {
		const params = new URLSearchParams(window.location.search);
		return params.get("room") || "";
	});
	const [error, setError] = useState(null);
	const [connecting, setConnecting] = useState(false);
	const peerRef = useRef(null);
	const connsRef = useRef([]); // host: [{conn, name}]
	const guestConnRef = useRef(null); // guest: conn to host

	const [lobbyPlayers, setLobbyPlayers] = useState([]);

	// Set selection
	const [sets, setSets] = useState([]);
	const [loadingSets, setLoadingSets] = useState(false);
	const [selectedSets, setSelectedSets] = useState([]);
	const [setSearch, setSetSearch] = useState("");

	useEffect(() => {
		if (step === "set-select" && sets.length === 0) {
			setLoadingSets(true);
			fetch("https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250")
				.then((r) => r.json())
				.then((data) => {
					setSets(data.data || []);
					setLoadingSets(false);
				})
				.catch(() => setLoadingSets(false));
		}
	}, [step]);

	const toggleSet = (set) => {
		setSelectedSets((prev) => (prev.find((s) => s.id === set.id) ? prev.filter((s) => s.id !== set.id) : [...prev, set]));
	};

	const filteredSets = setSearch
		? sets.filter(
				(s) => s.name.toLowerCase().includes(setSearch.toLowerCase()) || s.series.toLowerCase().includes(setSearch.toLowerCase()),
			)
		: sets;

	const handleHost = () => {
		setError(null);
		const code = makeRoomCode();
		const peer = new Peer(code);
		peerRef.current = peer;
		connsRef.current = [];

		peer.on("open", (id) => {
			roomCodeRef.current = id;
			setRoomCode(id);
			setLobbyPlayers([playerName]);
			setStep("waiting");
			window.history.pushState({}, "", `?room=${id}`);
		});

		peer.on("connection", (conn) => {
			conn.on("open", () => {
				const currentPlayers = [playerName, ...connsRef.current.map((c) => c.name)];
				conn.send({ type: "welcome", hostName: playerName, players: currentPlayers });
			});

			conn.on("data", (data) => {
				if (data.type === "guest-ready") {
					connsRef.current = [...connsRef.current, { conn, name: data.guestName }];
					const newPlayers = [playerName, ...connsRef.current.map((c) => c.name)];
					setLobbyPlayers(newPlayers);
					connsRef.current.forEach(({ conn: c }) => {
						c.send({ type: "player-joined", players: newPlayers });
					});
				}
			});

			conn.on("close", () => {
				const removed = connsRef.current.find((c) => c.conn === conn);
				connsRef.current = connsRef.current.filter((c) => c.conn !== conn);
				if (removed) {
					const newPlayers = [playerName, ...connsRef.current.map((c) => c.name)];
					setLobbyPlayers(newPlayers);
					connsRef.current.forEach(({ conn: c }) => {
						c.send({ type: "player-joined", players: newPlayers });
					});
				}
			});

			conn.on("error", () => setError("A connection error occurred."));
		});

		peer.on("error", (err) => {
			if (err.type === "unavailable-id") {
				peer.destroy();
				handleHost();
			} else {
				setError("Could not create room. Check your connection.");
			}
		});
	};

	const handleStart = () => {
		const allPlayers = lobbyPlayers;
		connsRef.current.forEach(({ conn }) => {
			conn.send({ type: "game-start", players: allPlayers });
		});
		onGameStart({
			peer: peerRef.current,
			conns: connsRef.current,
			isHost: true,
			myName: playerName,
			players: allPlayers,
			roomCode: roomCodeRef.current,
			selectedSets,
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
			guestConnRef.current = conn;

			conn.on("data", (data) => {
				if (data.type === "welcome") {
					setLobbyPlayers(data.players);
					conn.send({ type: "guest-ready", guestName: playerName });
					setConnecting(false);
					setStep("lobby");
				} else if (data.type === "player-joined") {
					setLobbyPlayers(data.players);
				} else if (data.type === "game-start") {
					onGameStart({
						peer,
						conn,
						isHost: false,
						myName: playerName,
						players: data.players,
						roomCode: roomCodeInput.trim().toUpperCase(),
						selectedSets: [],
					});
				}
			});

			conn.on("error", () => {
				setError("Room not found. Check the code.");
				setConnecting(false);
				peer.destroy();
			});

			conn.on("close", () => {
				setError("Host disconnected.");
				setConnecting(false);
				setStep("joining");
			});

			setTimeout(() => {
				if (!conn.open) {
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

	// Set selection step is full-screen
	if (step === "set-select") {
		return (
			<div className="min-h-screen bg-[#0c0c18] text-white flex flex-col">
				<div className="flex items-center justify-between px-8 pt-6 pb-4 flex-shrink-0 border-b border-white/[0.06]">
					<button
						onClick={() => setStep("mode")}
						className="text-white/30 text-[10px] tracking-widest uppercase hover:text-white/70 transition-colors cursor-pointer"
					>
						← Back
					</button>
					<div className="text-center">
						<p className="text-white text-sm font-light tracking-wide">Select Sets</p>
						<p className="text-white/25 text-[10px] tracking-widest mt-0.5">
							{selectedSets.length === 0 ? "All sets" : `${selectedSets.length} selected`}
						</p>
					</div>
					<button
						onClick={handleHost}
						className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-6 py-2.5 rounded-full hover:bg-amber-300 hover:text-gray-900 hover:border-amber-300 transition-all duration-300 cursor-pointer"
					>
						Create Room
					</button>
				</div>

				<div className="px-8 py-4 flex gap-3 flex-shrink-0">
					<input
						type="text"
						placeholder="Search sets..."
						value={setSearch}
						onChange={(e) => setSetSearch(e.target.value)}
						className="flex-1 bg-transparent border border-white/15 text-white text-xs placeholder-white/25 px-4 py-2.5 rounded-full focus:outline-none focus:border-white/35 tracking-wide transition-colors"
					/>
					<button
						onClick={() => setSelectedSets([])}
						className={`border text-[10px] tracking-widest uppercase px-5 py-2.5 rounded-full transition-all duration-200 cursor-pointer whitespace-nowrap flex-shrink-0 flex items-center gap-2 ${
							selectedSets.length === 0
								? "border-white bg-white text-black"
								: "border-white/25 text-white/50 hover:border-white/40 hover:text-white/70"
						}`}
					>
						{selectedSets.length === 0 && (
							<svg
								width="10"
								height="10"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="3"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M20 6 9 17l-5-5" />
							</svg>
						)}
						All Sets
					</button>
				</div>

				{selectedSets.length === 0 ? (
					<div className="mx-8 mb-3 px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 flex-shrink-0">
						<p className="text-white/60 text-[10px] tracking-widest uppercase text-center">
							All {sets.length > 0 ? sets.length : ""} sets active — cards from any set may appear
						</p>
					</div>
				) : (
					<div className="mx-8 mb-3 px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 flex-shrink-0">
						<p className="text-white/60 text-[10px] tracking-widest uppercase text-center">
							{selectedSets.length} set{selectedSets.length !== 1 ? "s" : ""} selected — click a set to deselect it
						</p>
					</div>
				)}

				<div className="flex-1 overflow-y-auto px-8 pb-8">
					{loadingSets ? (
						<div className="flex items-center justify-center h-48">
							<p className="text-white/25 text-[10px] tracking-widest uppercase animate-pulse">Loading sets...</p>
						</div>
					) : (
						<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
							{filteredSets.map((set) => {
								const allSetsMode = selectedSets.length === 0;
								const selected = allSetsMode || selectedSets.some((s) => s.id === set.id);
								const explicitlySelected = selectedSets.some((s) => s.id === set.id);
								return (
									<button
										key={set.id}
										onClick={() => toggleSet(set)}
										className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 cursor-pointer group ${
											explicitlySelected
												? "border-white/40 bg-white/[0.07]"
												: allSetsMode
													? "border-white/[0.06] hover:border-white/15 hover:bg-white/[0.04]"
													: "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
										}`}
									>
										{set.images?.logo ? (
											<img
												src={set.images.logo}
												alt={set.name}
												className={`h-14 w-full object-contain transition-opacity duration-200 ${
													selected ? "opacity-90" : "opacity-30 group-hover:opacity-50"
												}`}
											/>
										) : (
											<div className="h-14 w-full flex items-center justify-center">
												<p className={`text-[10px] text-center ${selected ? "text-white/50" : "text-white/20"}`}>{set.name}</p>
											</div>
										)}
										<div className="text-center">
											<p
												className={`text-[10px] font-light leading-snug transition-colors ${selected ? "text-white/70" : "text-white/25"}`}
											>
												{set.name}
											</p>
											<p className="text-white/20 text-[9px] tracking-wider mt-0.5">{set.total} cards</p>
										</div>
										{explicitlySelected && (
											<div className="w-4 h-4 rounded-full bg-white flex items-center justify-center flex-shrink-0">
												<svg
													width="8"
													height="8"
													viewBox="0 0 24 24"
													fill="none"
													stroke="black"
													strokeWidth="3"
													strokeLinecap="round"
													strokeLinejoin="round"
												>
													<path d="M20 6 9 17l-5-5" />
												</svg>
											</div>
										)}
									</button>
								);
							})}
						</div>
					)}
				</div>
			</div>
		);
	}

	// Centered layout for all other steps
	return (
		<div className="min-h-screen bg-[#0c0c18] text-white flex flex-col items-center justify-center relative">
			<button
				onClick={() => {
					peerRef.current?.destroy();
					window.history.pushState({}, "", "/");
					onBack();
				}}
				className="fixed top-6 left-8 text-white/30 text-[10px] tracking-widest uppercase hover:text-white/70 transition-colors duration-300 cursor-pointer"
			>
				← Back
			</button>

			<div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
				{/* Name + Mode — combined landing screen */}
				{(step === "name" || step === "mode") && (
					<div className="flex flex-col items-center gap-8 w-full">
						<div className="text-center">
							<p className="text-amber-300/50 text-[10px] tracking-widest uppercase mb-4">Pokémon TCG</p>
							<h1 className="text-5xl font-light tracking-wide bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent uppercase">
								Higher or Lower
							</h1>
							<p className="text-white/20 text-xs tracking-widest uppercase mt-4">Multiplayer</p>
						</div>

						<div className="flex flex-col gap-3 w-full">
							<input
								type="text"
								placeholder="Your name"
								value={playerName}
								onChange={(e) => setPlayerName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && playerName.trim()) {
										if (hasRoomInUrl) setStep("joining");
									}
								}}
								maxLength={20}
								autoFocus
								className="w-full bg-transparent border border-white/15 text-white text-sm placeholder-white/25 px-5 py-3 rounded-full focus:outline-none focus:border-white/35 tracking-wide transition-colors text-center"
							/>

							{hasRoomInUrl ? (
								<button
									disabled={!playerName.trim()}
									onClick={() => setStep("joining")}
									className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-10 py-3 rounded-full hover:bg-amber-300 hover:text-gray-900 hover:border-amber-300 transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
								>
									Join Room
								</button>
							) : (
								<>
									<button
										disabled={!playerName.trim()}
										onClick={() => setStep("set-select")}
										className="border border-amber-300/30 text-amber-300/70 text-[10px] tracking-widest uppercase px-10 py-3 rounded-full hover:bg-amber-300 hover:text-gray-900 hover:border-amber-300 transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
									>
										Host a Room
									</button>
									<button
										disabled={!playerName.trim()}
										onClick={() => setStep("joining")}
										className="border border-white/20 text-white/50 text-[10px] tracking-widest uppercase px-10 py-3 rounded-full hover:bg-amber-300 hover:text-gray-900 hover:border-amber-300 transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
									>
										Join a Room
									</button>
								</>
							)}
						</div>
					</div>
				)}

				{/* Waiting — host lobby */}
				{step === "waiting" && roomCode && (
					<div className="flex flex-col items-center gap-6 w-full">
						<div className="text-center">
							<p className="text-white/30 text-[10px] tracking-widest uppercase mb-2">Room code</p>
							<button
								onClick={copyCode}
								title="Click to copy"
								className="text-4xl font-light tracking-[0.3em] text-white hover:text-white/60 transition-colors cursor-pointer"
							>
								{roomCode}
							</button>
							<p className="text-white/20 text-[10px] tracking-widest mt-1">click to copy</p>
						</div>

						{/* Player list */}
						<div className="w-full flex flex-col gap-2">
							{lobbyPlayers.map((name, i) => (
								<div
									key={name}
									className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07]"
								>
									<div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
									<span className="text-white/70 text-xs tracking-wide flex-1">{name}</span>
									{i === 0 && <span className="text-white/25 text-[9px] tracking-widest uppercase">host</span>}
								</div>
							))}
							{lobbyPlayers.length < 2 && (
								<div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-dashed border-white/[0.08]">
									<div className="w-1.5 h-1.5 rounded-full bg-white/15 animate-pulse flex-shrink-0" />
									<span className="text-white/20 text-xs tracking-wide">Waiting for players...</span>
								</div>
							)}
						</div>

						<button
							onClick={handleStart}
							disabled={lobbyPlayers.length < 2}
							className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-10 py-3 rounded-full hover:bg-amber-300 hover:text-gray-900 hover:border-amber-300 transition-all duration-300 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed w-full"
						>
							Start Game
						</button>

						{selectedSets.length > 0 && (
							<p className="text-white/20 text-[9px] tracking-widest uppercase">
								{selectedSets.length === 1 ? selectedSets[0].name : `${selectedSets.length} sets selected`}
							</p>
						)}
					</div>
				)}

				{/* Lobby — guest waiting for host to start */}
				{step === "lobby" && (
					<div className="flex flex-col items-center gap-6 w-full">
						<div className="text-center">
							<p className="text-white/20 text-[10px] tracking-widest font-mono">{roomCodeInput.trim().toUpperCase()}</p>
						</div>

						<div className="w-full flex flex-col gap-2">
							{lobbyPlayers.map((name, i) => (
								<div
									key={name}
									className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07]"
								>
									<div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
									<span className={`text-xs tracking-wide flex-1 ${name === playerName ? "text-white" : "text-white/70"}`}>
										{name}
									</span>
									{i === 0 && <span className="text-white/25 text-[9px] tracking-widest uppercase">host</span>}
									{name === playerName && i !== 0 && (
										<span className="text-white/25 text-[9px] tracking-widest uppercase">you</span>
									)}
								</div>
							))}
						</div>

						<div className="flex items-center gap-2">
							<div className="w-1.5 h-1.5 rounded-full bg-white/25 animate-pulse" />
							<p className="text-white/30 text-[10px] tracking-widest uppercase">Waiting for host to start...</p>
						</div>
					</div>
				)}

				{/* Join */}
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
							className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-10 py-3 rounded-full hover:bg-amber-300 hover:text-gray-900 hover:border-amber-300 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
