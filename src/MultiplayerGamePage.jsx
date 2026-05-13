import { useState, useEffect, useRef } from "react";

const BATCH_SIZE = 100;

export default function MultiplayerGamePage({ peer, conn, isHost, myName, opponentName, roomCode, onBack }) {
	const [card1, setCard1] = useState(null);
	const [card2, setCard2] = useState(null);
	const [myGuess, setMyGuess] = useState(null);
	const [opponentGuessed, setOpponentGuessed] = useState(false);
	const [roundResult, setRoundResult] = useState(null);
	const [myScore, setMyScore] = useState(0);
	const [opponentScore, setOpponentScore] = useState(0);
	const [animatedPrice, setAnimatedPrice] = useState(0);
	const [status, setStatus] = useState("loading");
	const [disconnected, setDisconnected] = useState(false);

	// Host-only: tracks guest's guess while waiting for host to also guess
	const guestGuessRef = useRef(null);
	// Host-only: tracks host's own guess while waiting for guest
	const hostGuessRef = useRef(null);
	// Host-only: scores
	const myScoreRef = useRef(0);
	const opponentScoreRef = useRef(0);

	// Card pool — host only
	const cardPoolRef = useRef([]);
	const isLoadingPoolRef = useRef(false);

	const fetchCardBatch = async () => {
		try {
			const page = Math.floor(Math.random() * 100) + 1;
			const res = await fetch(`https://api.pokemontcg.io/v2/cards?pageSize=${BATCH_SIZE}&page=${page}&q=supertype:pokemon`);
			if (!res.ok) throw new Error();
			const data = await res.json();
			return data.data || [];
		} catch {
			return [];
		}
	};

	const preloadPool = async () => {
		if (isLoadingPoolRef.current) return;
		isLoadingPoolRef.current = true;
		try {
			const batches = await Promise.all([fetchCardBatch(), fetchCardBatch()]);
			const cards = batches.flat().filter((c) => c?.cardmarket?.prices?.averageSellPrice !== undefined);
			const unique = Array.from(new Map([...cardPoolRef.current, ...cards].map((c) => [c.id, c])).values());
			cardPoolRef.current = unique.slice(-200);
		} finally {
			isLoadingPoolRef.current = false;
		}
	};

	const pickTwo = () => {
		const pool = cardPoolRef.current;
		if (pool.length < 2) return null;
		const i1 = Math.floor(Math.random() * pool.length);
		let i2 = Math.floor(Math.random() * pool.length);
		while (i2 === i1) i2 = Math.floor(Math.random() * pool.length);
		return [pool[i1], pool[i2]];
	};

	const sendNewRound = async () => {
		setStatus("loading");
		if (cardPoolRef.current.length < 10) await preloadPool();
		let pair = pickTwo();
		if (!pair) {
			await preloadPool();
			pair = pickTwo();
		}
		if (pair) {
			guestGuessRef.current = null;
			hostGuessRef.current = null;
			conn.send({ type: "new-round", card1: pair[0], card2: pair[1] });
			// Host also receives new-round locally
			setCard1(pair[0]);
			setCard2(pair[1]);
			setMyGuess(null);
			setOpponentGuessed(false);
			setRoundResult(null);
			setAnimatedPrice(0);
			setStatus("playing");
		}
	};

	// Host resolves round when both guesses are in
	const resolveRound = (hGuess, gGuess, c1, c2) => {
		const price1 = c1.cardmarket.prices.averageSellPrice;
		const price2 = c2.cardmarket.prices.averageSellPrice;
		const hostCorrect = hGuess === "more" ? price2 > price1 : price2 < price1;
		const guestCorrect = gGuess === "more" ? price2 > price1 : price2 < price1;

		if (hostCorrect) myScoreRef.current += 1;
		if (guestCorrect) opponentScoreRef.current += 1;

		const result = {
			type: "round-result",
			hostGuess: hGuess,
			guestGuess: gGuess,
			price1,
			price2,
			hostScore: myScoreRef.current,
			guestScore: opponentScoreRef.current,
			hostCorrect,
			guestCorrect,
		};

		conn.send(result);

		// Apply locally
		setRoundResult(result);
		setMyScore(myScoreRef.current);
		setOpponentScore(opponentScoreRef.current);
		setStatus("revealing");

		setTimeout(() => sendNewRound(), 3500);
	};

	// Price animation
	useEffect(() => {
		if (!roundResult) {
			setAnimatedPrice(0);
			return;
		}
		const target = roundResult.price2;
		const duration = 1000;
		const start = Date.now();
		let raf;
		const tick = () => {
			const progress = Math.min((Date.now() - start) / duration, 1);
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

	// Set up connection handlers + kick off game
	useEffect(() => {
		const card1Ref = { current: null };
		const card2Ref = { current: null };

		// Keep a ref to the current cards so resolveRound can access them
		const updateCards = (c1, c2) => {
			card1Ref.current = c1;
			card2Ref.current = c2;
		};

		conn.on("data", (data) => {
			switch (data.type) {
				case "new-round":
					// Guest receives cards from host
					if (!isHost) {
						card1Ref.current = data.card1;
						card2Ref.current = data.card2;
						setCard1(data.card1);
						setCard2(data.card2);
						setMyGuess(null);
						setOpponentGuessed(false);
						setRoundResult(null);
						setAnimatedPrice(0);
						setStatus("playing");
					}
					break;

				case "opponent-guessed":
					// The other player has locked in (without knowing what they picked)
					setOpponentGuessed(true);
					break;

				case "guess":
					// Host receives guest's guess
					if (isHost) {
						guestGuessRef.current = data.guess;
						setOpponentGuessed(true);
						if (hostGuessRef.current !== null) {
							resolveRound(hostGuessRef.current, guestGuessRef.current, card1Ref.current, card2Ref.current);
						}
					}
					break;

				case "round-result":
					// Guest receives result from host
					if (!isHost) {
						setRoundResult(data);
						setMyScore(data.guestScore);
						setOpponentScore(data.hostScore);
						setStatus("revealing");
					}
					break;
			}
		});

		conn.on("close", () => setDisconnected(true));
		conn.on("error", () => setDisconnected(true));

		// Sync card refs whenever card state updates
		const origSetCard1 = setCard1;
		const origSetCard2 = setCard2;

		if (isHost) {
			preloadPool().then(sendNewRound);
		}

		return () => {
			conn.off("data");
			conn.off("close");
			conn.off("error");
		};
	}, []);

	// Host needs card refs in resolveRound — sync via a separate effect
	const card1Ref = useRef(null);
	const card2Ref = useRef(null);
	useEffect(() => {
		card1Ref.current = card1;
	}, [card1]);
	useEffect(() => {
		card2Ref.current = card2;
	}, [card2]);

	const handleGuess = (guess) => {
		if (myGuess || status !== "playing") return;
		setMyGuess(guess);

		if (isHost) {
			hostGuessRef.current = guess;
			conn.send({ type: "opponent-guessed" }); // tell guest that host has guessed
			if (guestGuessRef.current !== null) {
				resolveRound(guess, guestGuessRef.current, card1Ref.current, card2Ref.current);
			}
		} else {
			conn.send({ type: "guess", guess });
		}
	};

	const myResult = roundResult ? (isHost ? roundResult.hostCorrect : roundResult.guestCorrect) : null;
	const opponentResult = roundResult ? (isHost ? roundResult.guestCorrect : roundResult.hostCorrect) : null;
	const myGuessInResult = roundResult ? (isHost ? roundResult.hostGuess : roundResult.guestGuess) : null;
	const opponentGuessInResult = roundResult ? (isHost ? roundResult.guestGuess : roundResult.hostGuess) : null;

	return (
		<div className="w-screen h-screen bg-black overflow-hidden flex flex-col relative">
			{/* Top bar */}
			<div className="flex items-center justify-between px-8 pt-6 pb-4 flex-shrink-0 z-50">
				<button
					onClick={() => {
						peer.destroy();
						onBack();
					}}
					className="text-white/30 text-[10px] tracking-widest uppercase hover:text-white/70 transition-colors duration-300 cursor-pointer"
				>
					← Leave
				</button>

				<div className="flex items-center gap-8">
					<div className="text-right">
						<p className="text-white/40 text-[10px] tracking-widest uppercase">{myName}</p>
						<p className="text-white text-3xl font-light tabular-nums">{myScore}</p>
					</div>
					<div className="text-white/15 text-xs">vs</div>
					<div className="text-left">
						<p className="text-white/40 text-[10px] tracking-widest uppercase">{opponentName}</p>
						<p className="text-white text-3xl font-light tabular-nums">{opponentScore}</p>
					</div>
				</div>

				<p className="text-white/20 text-[10px] tracking-widest font-mono">{roomCode}</p>
			</div>

			{/* Disconnected overlay */}
			{disconnected && (
				<div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center gap-4">
					<p className="text-white/60 text-sm tracking-wide">Opponent disconnected</p>
					<button
						onClick={() => {
							peer.destroy();
							onBack();
						}}
						className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-8 py-3 rounded-full hover:bg-white hover:text-black transition-all duration-300 cursor-pointer"
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

			{/* Game */}
			{(status === "playing" || status === "revealing") && card1 && card2 && (
				<div className="flex-1 flex items-center justify-center relative">
					{/* VS badge */}
					<div
						className="absolute z-30 rounded-full w-12 h-12 flex items-center justify-center overflow-hidden shadow-2xl"
						style={{ marginTop: "-8rem" }}
					>
						<div className="absolute inset-0 bg-white rounded-full" />
						<span className="relative z-[2] text-black font-medium text-[10px] tracking-widest uppercase">vs</span>
					</div>

					<div className="flex items-start gap-28">
						{/* Card 1 */}
						<div className="flex flex-col items-center w-72">
							<img className="w-full h-auto rounded-xl shadow-2xl" src={card1.images.large} alt={card1.name} />
							<div className="flex flex-col items-center gap-1 text-center mt-4">
								<p className="text-white/30 text-[10px] tracking-widest uppercase">{card1.set?.name}</p>
								<p className="text-white text-lg font-light mt-1">{card1.name}</p>
								<p className="text-white/25 text-[10px] tracking-widest uppercase mt-4">avg. sell price</p>
								<p className="text-white text-xl font-light mt-1">
									${(roundResult?.price1 ?? card1.cardmarket?.prices?.averageSellPrice ?? 0).toFixed(2)}
								</p>
							</div>
						</div>

						{/* Card 2 */}
						<div className="flex flex-col items-center w-72">
							<img className="w-full h-auto rounded-xl shadow-2xl" src={card2.images.large} alt={card2.name} />
							<div className="flex flex-col items-center gap-1 text-center mt-4 min-h-[220px]">
								<p className="text-white/30 text-[10px] tracking-widest uppercase">{card2.set?.name}</p>
								<p className="text-white text-lg font-light mt-1">{card2.name}</p>

								{status === "revealing" ? (
									<>
										<p className="text-white/25 text-[10px] tracking-widest uppercase mt-4">avg. sell price</p>
										<p className="text-white text-xl font-light mt-1">${animatedPrice.toFixed(2)}</p>
										<div className="flex gap-8 mt-5">
											<div className="flex flex-col items-center gap-1">
												<p className="text-white/30 text-[10px] tracking-widest uppercase">{myName}</p>
												<p className={`text-sm font-light ${myResult ? "text-emerald-400" : "text-red-400/70"}`}>
													{myGuessInResult} {myResult ? "✓" : "✗"}
												</p>
											</div>
											<div className="flex flex-col items-center gap-1">
												<p className="text-white/30 text-[10px] tracking-widest uppercase">{opponentName}</p>
												<p className={`text-sm font-light ${opponentResult ? "text-emerald-400" : "text-red-400/70"}`}>
													{opponentGuessInResult} {opponentResult ? "✓" : "✗"}
												</p>
											</div>
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
														: "border-white/25 text-white/70 hover:bg-white hover:text-black cursor-pointer"
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
														: "border-white/25 text-white/70 hover:bg-white hover:text-black cursor-pointer"
												}`}
											>
												Less
											</button>
											<p className="text-white/20 text-[10px] tracking-wider mt-2">than {card1.name}</p>
										</div>
										<div className="flex items-center gap-2 mt-5">
											<div
												className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${opponentGuessed ? "bg-emerald-400" : "bg-white/20 animate-pulse"}`}
											/>
											<p className="text-white/25 text-[10px] tracking-widest uppercase">
												{opponentGuessed ? `${opponentName} locked in` : `${opponentName} thinking...`}
											</p>
										</div>
									</>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
