import { useState, useEffect, useRef } from "react";

const BATCH_SIZE = 100;

export default function MultiplayerGamePage({
	peer,
	conns = [],
	conn,
	isHost,
	myName,
	players = [],
	roomCode,
	selectedSets,
	onBack,
}) {
	const [card1, setCard1] = useState(null);
	const [card2, setCard2] = useState(null);
	const [nextCard2, setNextCard2] = useState(null);
	const [isSliding, setIsSliding] = useState(false);
	const [myGuess, setMyGuess] = useState(null);
	const [lockedIn, setLockedIn] = useState({});
	const [roundResult, setRoundResult] = useState(null);
	const [scores, setScores] = useState(() => Object.fromEntries(players.map((n) => [n, 0])));
	const [animatedPrice, setAnimatedPrice] = useState(0);
	const [vsFillProgress, setVsFillProgress] = useState(0);
	const [card2InfoVisible, setCard2InfoVisible] = useState(false);
	const [status, setStatus] = useState("loading");
	const [disconnected, setDisconnected] = useState(false);

	const guessesRef = useRef({});
	const scoresRef = useRef(Object.fromEntries(players.map((n) => [n, 0])));
	const card1Ref = useRef(null);
	const card2Ref = useRef(null);
	const nextCard1Ref = useRef(null);
	const isFirstRoundRef = useRef(true);
	const cardPoolRef = useRef([]);
	const isLoadingPoolRef = useRef(false);
	const vsAnimationFrameRef = useRef(null);
	const vsTimeoutRef = useRef(null);

	const broadcast = (msg) => {
		conns.forEach(({ conn: c }) => {
			try {
				c.send(msg);
			} catch (_) {}
		});
	};

	const fetchCardBatch = async () => {
		try {
			let url;
			if (!selectedSets?.length) {
				url = `https://api.pokemontcg.io/v2/cards?pageSize=${BATCH_SIZE}&page=${Math.floor(Math.random() * 100) + 1}&q=supertype:pokemon`;
			} else {
				const set = selectedSets[Math.floor(Math.random() * selectedSets.length)];
				const maxPage = Math.max(1, Math.ceil((set.total || BATCH_SIZE) / BATCH_SIZE));
				url = `https://api.pokemontcg.io/v2/cards?pageSize=${BATCH_SIZE}&page=${Math.floor(Math.random() * maxPage) + 1}&q=supertype:pokemon set.id:${set.id}`;
			}
			const res = await fetch(url);
			if (!res.ok) throw new Error();
			return (await res.json()).data || [];
		} catch {
			return [];
		}
	};

	const preloadPool = async () => {
		if (isLoadingPoolRef.current) return;
		isLoadingPoolRef.current = true;
		try {
			const cards = (await Promise.all([fetchCardBatch(), fetchCardBatch()]))
				.flat()
				.filter((c) => c?.cardmarket?.prices?.averageSellPrice !== undefined);
			const unique = Array.from(new Map([...cardPoolRef.current, ...cards].map((c) => [c.id, c])).values());
			cardPoolRef.current = unique.slice(-200);
		} finally {
			isLoadingPoolRef.current = false;
		}
	};

	const pickOne = () => {
		const pool = cardPoolRef.current;
		if (!pool.length) return null;
		return pool[Math.floor(Math.random() * pool.length)];
	};

	const startRound = (c1, c2) => {
		guessesRef.current = {};
		card1Ref.current = c1;
		card2Ref.current = c2;

		if (isFirstRoundRef.current) {
			isFirstRoundRef.current = false;
			setCard1(c1);
			setCard2(c2);
			setMyGuess(null);
			setLockedIn({});
			setRoundResult(null);
			setAnimatedPrice(0);
			setCard2InfoVisible(false);
			setStatus("playing");
			setTimeout(() => setCard2InfoVisible(true), 200);
		} else {
			setNextCard2(c2);
			setIsSliding(true);
			setTimeout(() => {
				setCard1(c1);
				setCard2(c2);
				setMyGuess(null);
				setLockedIn({});
				setRoundResult(null);
				setAnimatedPrice(0);
				setIsSliding(false);
				setNextCard2(null);
				setCard2InfoVisible(false);
				setStatus("playing");
				setTimeout(() => setCard2InfoVisible(true), 150);
			}, 600);
		}
	};

	const sendNewRound = async () => {
		if (cardPoolRef.current.length < 10) await preloadPool();

		const c1 = nextCard1Ref.current || pickOne();
		nextCard1Ref.current = null;
		let c2 = pickOne();
		while (c2 && c1 && c2.id === c1.id) c2 = pickOne();

		if (!c1 || !c2) {
			setStatus("loading");
			await preloadPool();
			const fc1 = nextCard1Ref.current || pickOne();
			nextCard1Ref.current = null;
			let fc2 = pickOne();
			while (fc2 && fc1 && fc2.id === fc1.id) fc2 = pickOne();
			if (!fc1 || !fc2) return;
			broadcast({ type: "new-round", card1: fc1, card2: fc2 });
			startRound(fc1, fc2);
			return;
		}

		broadcast({ type: "new-round", card1: c1, card2: c2 });
		startRound(c1, c2);
	};

	const resolveRound = () => {
		const c1 = card1Ref.current;
		const c2 = card2Ref.current;
		if (!c1 || !c2) return;
		const price1 = c1.cardmarket.prices.averageSellPrice;
		const price2 = c2.cardmarket.prices.averageSellPrice;
		const results = {};
		const newScores = { ...scoresRef.current };
		players.forEach((name) => {
			const guess = guessesRef.current[name];
			const correct = guess ? (guess === "more" ? price2 > price1 : price2 < price1) : false;
			if (correct) newScores[name] = (newScores[name] || 0) + 1;
			results[name] = { guess: guess || null, correct };
		});
		scoresRef.current = newScores;
		nextCard1Ref.current = c2;
		const result = { type: "round-result", price1, price2, results, scores: newScores };
		broadcast(result);
		setRoundResult(result);
		setScores({ ...newScores });
		setStatus("revealing");
		setTimeout(sendNewRound, 3500);
	};

	const checkAllGuessed = () => {
		if (players.every((n) => guessesRef.current[n] !== undefined)) resolveRound();
	};

	const handleGuess = (guess) => {
		if (myGuess || status !== "playing") return;
		setMyGuess(guess);
		setLockedIn((prev) => ({ ...prev, [myName]: true }));
		if (isHost) {
			guessesRef.current[myName] = guess;
			broadcast({ type: "player-locked", playerName: myName });
			checkAllGuessed();
		} else {
			conn.send({ type: "guess", guess });
		}
	};

	// Price animation
	useEffect(() => {
		if (!roundResult) {
			setAnimatedPrice(0);
			return;
		}
		const target = roundResult.price2;
		const start = Date.now();
		let raf;
		const tick = () => {
			const progress = Math.min((Date.now() - start) / 1000, 1);
			setAnimatedPrice(target * (1 - Math.pow(1 - progress, 3)));
			if (progress < 1) raf = requestAnimationFrame(tick);
			else setAnimatedPrice(target);
		};
		const t = setTimeout(() => {
			raf = requestAnimationFrame(tick);
		}, 10);
		return () => {
			clearTimeout(t);
			if (raf) cancelAnimationFrame(raf);
		};
	}, [roundResult]);

	// VS Pokeball fill — triggers when my guess is correct
	useEffect(() => {
		if (vsTimeoutRef.current) {
			clearTimeout(vsTimeoutRef.current);
			vsTimeoutRef.current = null;
		}
		if (vsAnimationFrameRef.current) {
			cancelAnimationFrame(vsAnimationFrameRef.current);
			vsAnimationFrameRef.current = null;
		}
		const myCorrect = roundResult?.results?.[myName]?.correct;
		if (roundResult && myCorrect) {
			setVsFillProgress(0);
			vsTimeoutRef.current = setTimeout(() => {
				const duration = 800;
				const startTime = Date.now();
				const animate = () => {
					const progress = Math.min((Date.now() - startTime) / duration, 1);
					setVsFillProgress(1 - Math.pow(1 - progress, 3));
					if (progress < 1) {
						vsAnimationFrameRef.current = requestAnimationFrame(animate);
					} else {
						setVsFillProgress(1);
						vsAnimationFrameRef.current = null;
					}
				};
				vsAnimationFrameRef.current = requestAnimationFrame(animate);
			}, 1000);
		} else {
			setVsFillProgress(0);
		}
		return () => {
			if (vsTimeoutRef.current) {
				clearTimeout(vsTimeoutRef.current);
				vsTimeoutRef.current = null;
			}
			if (vsAnimationFrameRef.current) {
				cancelAnimationFrame(vsAnimationFrameRef.current);
				vsAnimationFrameRef.current = null;
			}
		};
	}, [roundResult]);

	useEffect(() => {
		if (isHost) {
			conns.forEach(({ conn: c, name }) => {
				c.on("data", (data) => {
					if (data.type === "guess") {
						guessesRef.current[name] = data.guess;
						setLockedIn((prev) => ({ ...prev, [name]: true }));
						broadcast({ type: "player-locked", playerName: name });
						checkAllGuessed();
					}
				});
				c.on("close", () => setDisconnected(true));
				c.on("error", () => setDisconnected(true));
			});
			preloadPool().then(sendNewRound);
		} else {
			conn.on("data", (data) => {
				switch (data.type) {
					case "new-round":
						card1Ref.current = data.card1;
						card2Ref.current = data.card2;
						startRound(data.card1, data.card2);
						break;
					case "player-locked":
						setLockedIn((prev) => ({ ...prev, [data.playerName]: true }));
						break;
					case "round-result":
						nextCard1Ref.current = card2Ref.current;
						setRoundResult(data);
						setScores({ ...data.scores });
						setStatus("revealing");
						break;
				}
			});
			conn.on("close", () => setDisconnected(true));
			conn.on("error", () => setDisconnected(true));
		}
		return () => {
			if (isHost) {
				conns.forEach(({ conn: c }) => {
					c.off("data");
					c.off("close");
					c.off("error");
				});
			} else {
				conn.off("data");
				conn.off("close");
				conn.off("error");
			}
		};
	}, []);

	const sortedPlayers = [...players].sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
	const myCorrect = roundResult?.results?.[myName]?.correct;

	// Identical to single player: min-h-[200px] covers both playing (~167px) and
	// revealing (~106px) so the section never changes height between states.
	const CardInfo = ({ card, children }) => (
		<div className="flex flex-col items-center gap-1 text-center mt-4">
			<p className="text-white/30 text-[10px] tracking-widest uppercase">{card.set?.name}</p>
			<p className="text-white text-lg font-light mt-1">{card.name}</p>
			<div className="flex flex-col items-center min-h-[200px]">{children}</div>
		</div>
	);

	return (
		<div className="w-screen min-h-screen bg-[#0c0c18] flex flex-col">
			{/* Sticky top bar */}
			<div className="sticky top-0 z-50 bg-[#0c0c18] flex items-center justify-between px-8 pt-6 pb-4 flex-shrink-0">
				<button
					onClick={() => {
						peer.destroy();
						onBack();
					}}
					className="text-white/30 text-[10px] tracking-widest uppercase hover:text-white/70 transition-colors duration-300 cursor-pointer"
				>
					← Leave
				</button>

				<div className="flex items-center gap-6">
					{sortedPlayers.map((name) => (
						<div key={name} className="text-center">
							<p className={`text-[10px] tracking-widest uppercase ${name === myName ? "text-amber-300/60" : "text-white/35"}`}>
								{name}
							</p>
							<p className={`text-3xl font-light tabular-nums ${name === myName ? "text-amber-300" : "text-white/50"}`}>
								{scores[name] || 0}
							</p>
						</div>
					))}
				</div>

				<p className="text-white/20 text-[10px] tracking-widest font-mono">{roomCode}</p>
			</div>

			{/* Disconnected overlay */}
			{disconnected && (
				<div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center gap-4">
					<p className="text-white/60 text-sm tracking-wide">A player disconnected</p>
					<button
						onClick={() => {
							peer.destroy();
							onBack();
						}}
						className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-8 py-3 rounded-full hover:bg-amber-300 hover:text-gray-900 hover:border-amber-300 transition-all duration-300 cursor-pointer"
					>
						Back to Home
					</button>
				</div>
			)}

			{/* Loading */}
			{status === "loading" && (
				<div className="flex-1 flex items-center justify-center">
					<p className="text-white/25 text-[10px] tracking-widest uppercase animate-pulse">
						{isHost ? "Loading cards..." : "Waiting for host..."}
					</p>
				</div>
			)}

			{/* Game — scrollable, cards anchored from top via items-start */}
			{(status === "playing" || status === "revealing") && card1 && card2 && (
				<div className="flex justify-center py-12">
					<div className="flex items-start gap-28 relative">
						{/* VS Badge — Pokeball (same as single player) */}
						<div
							className="absolute z-30 rounded-full w-14 h-14 flex items-center justify-center overflow-hidden"
							style={{ marginTop: "-8rem", boxShadow: "0 0 0 3px #0c0c18, 0 8px 32px rgba(0,0,0,0.6)" }}
						>
							<div className="absolute top-0 left-0 right-0 h-1/2 bg-red-500 z-0" />
							<div className="absolute bottom-0 left-0 right-0 h-1/2 bg-white z-0" />
							<div className="absolute top-1/2 left-0 right-0 h-[3px] bg-[#0c0c18] z-[1] -translate-y-1/2" />
							<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-[3px] border-[#0c0c18] bg-white z-[2]" />
							{roundResult && myCorrect && (
								<div
									className="absolute inset-0 bg-emerald-400 z-[3] rounded-full"
									style={{ clipPath: `inset(${100 - vsFillProgress * 100}% 0 0 0)` }}
								/>
							)}
							{!(roundResult && myCorrect && vsFillProgress >= 1) && (
								<span
									className="relative z-[4] text-white font-black text-xs tracking-widest uppercase"
									style={{
										textShadow: "0 1px 6px rgba(0,0,0,0.9)",
										opacity:
											roundResult && myCorrect && vsFillProgress >= 0.15 ? Math.max(0, 1 - (vsFillProgress - 0.15) / 0.85) : 1,
										transition: "opacity 0.3s ease-out",
									}}
								>
									vs
								</span>
							)}
							{roundResult && myCorrect && (
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="white"
									strokeWidth="2.5"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="absolute inset-0 m-auto z-[5] transition-opacity duration-500"
									style={{ opacity: vsFillProgress >= 1 ? 1 : 0, pointerEvents: "none" }}
								>
									<path d="M20 6 9 17l-5-5" />
								</svg>
							)}
						</div>

						{/* Card 1 */}
						<div className="flex flex-col items-center w-96">
							<img className="w-full h-auto rounded-xl shadow-2xl" src={card1.images.large} alt={card1.name} />
							<div
								style={{
									opacity: isSliding ? 0 : 1,
									transition: isSliding ? "opacity 0.3s ease-out" : "none",
								}}
							>
								<CardInfo card={card1}>
									<p className="text-white/25 text-[10px] tracking-widest uppercase mt-4">avg. sell price</p>
									<p className="text-amber-300 text-xl font-light mt-1">
										${(roundResult?.price1 ?? card1.cardmarket?.prices?.averageSellPrice ?? 0).toFixed(2)}
									</p>
								</CardInfo>
							</div>
						</div>

						{/* Card 2 — with slide animation */}
						<div className="relative w-96 overflow-visible">
							{card2 && (
								<div
									key={`card2-${card2.id}`}
									className="flex flex-col items-center w-96"
									style={{
										transform: isSliding ? "translateX(-31rem)" : "translateX(0)",
										transition: isSliding ? "transform 0.6s ease-in-out" : "none",
										position: "relative",
										zIndex: isSliding ? 40 : 2,
									}}
								>
									<img className="w-full h-auto rounded-xl shadow-2xl" src={card2.images.large} alt={card2.name} />
									<div
										style={{
											opacity: card2InfoVisible ? 1 : 0,
											transition: card2InfoVisible ? "opacity 0.4s ease-in" : "none",
										}}
									>
										<CardInfo card={card2}>
											{status === "revealing" ? (
												<>
													<p className="text-white/25 text-[10px] tracking-widest uppercase mt-4">avg. sell price</p>
													<p className="text-amber-300 text-xl font-light mt-1">${animatedPrice.toFixed(2)}</p>
													<div className="flex flex-wrap justify-center gap-5 mt-4">
														{players.map((name) => {
															const res = roundResult?.results?.[name];
															return (
																<div key={name} className="flex flex-col items-center gap-1">
																	<p className="text-white/30 text-[10px] tracking-widest uppercase">{name}</p>
																	<p className={`text-sm font-light ${res?.correct ? "text-emerald-400" : "text-rose-400"}`}>
																		{res?.guess || "—"} {res?.correct ? "✓" : "✗"}
																	</p>
																</div>
															);
														})}
													</div>
												</>
											) : (
												<>
													<div className="flex flex-col items-center gap-2 mt-5">
														<button
															disabled={!!myGuess}
															onClick={() => handleGuess("more")}
															className={`border text-[10px] tracking-widest uppercase px-8 py-2.5 rounded-full transition-all duration-300 w-36 ${
																myGuess === "more"
																	? "border-white/60 bg-white text-black cursor-default"
																	: "border-white/25 text-white/70 hover:bg-amber-300 hover:text-gray-900 hover:border-amber-300 cursor-pointer"
															}`}
														>
															More
														</button>
														<button
															disabled={!!myGuess}
															onClick={() => handleGuess("less")}
															className={`border text-[10px] tracking-widest uppercase px-8 py-2.5 rounded-full transition-all duration-300 w-36 ${
																myGuess === "less"
																	? "border-white/60 bg-white text-black cursor-default"
																	: "border-white/25 text-white/70 hover:bg-amber-300 hover:text-gray-900 hover:border-amber-300 cursor-pointer"
															}`}
														>
															Less
														</button>
														<p className="text-white/20 text-[10px] tracking-wider mt-2">than {card1.name}</p>
													</div>
													<div className="flex items-center gap-3 mt-4">
														{players.map((name) => (
															<div key={name} className="flex flex-col items-center gap-1.5">
																<div
																	className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${lockedIn[name] ? "bg-emerald-400" : "bg-white/20 animate-pulse"}`}
																/>
																<p className="text-white/20 text-[9px] tracking-widest uppercase">{name}</p>
															</div>
														))}
													</div>
												</>
											)}
										</CardInfo>
									</div>
								</div>
							)}

							{/* Next card sliding in from right — image only, info fades in after */}
							{nextCard2 && (
								<div
									key={`nextCard2-${nextCard2.id}`}
									className="absolute top-0 left-0 flex flex-col items-center w-96"
									style={{
										transform: isSliding ? "translateX(0)" : "translateX(35rem)",
										transition: isSliding ? "transform 0.6s ease-in-out" : "none",
										zIndex: 1,
									}}
								>
									<img className="w-full h-auto rounded-xl shadow-2xl" src={nextCard2.images.large} alt={nextCard2.name} />
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
