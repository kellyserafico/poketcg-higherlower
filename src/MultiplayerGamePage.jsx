import { useState, useEffect, useRef } from "react";

const BATCH_SIZE = 100;

export default function MultiplayerGamePage({ ws, players, isHost, roomCode, onBack }) {
	const myId = isHost ? "host" : "guest";
	const me = players.find((p) => p.id === myId);
	const opponent = players.find((p) => p.id !== myId);

	const [card1, setCard1] = useState(null);
	const [card2, setCard2] = useState(null);
	const [myGuess, setMyGuess] = useState(null);
	const [opponentGuessed, setOpponentGuessed] = useState(false);
	const [roundResult, setRoundResult] = useState(null);
	const [scores, setScores] = useState({ [myId]: 0, [opponent?.id]: 0 });
	const [animatedPrice, setAnimatedPrice] = useState(0);
	const [status, setStatus] = useState("loading"); // loading | playing | revealing | waiting
	const [disconnected, setDisconnected] = useState(false);

	const cardPoolRef = useRef([]);
	const isLoadingPoolRef = useRef(false);

	// Card fetching — only used by host
	const fetchCardBatch = async () => {
		try {
			const page = Math.floor(Math.random() * 100) + 1;
			const res = await fetch(`https://api.pokemontcg.io/v2/cards?pageSize=${BATCH_SIZE}&page=${page}&q=supertype:pokemon`);
			if (!res.ok) throw new Error("API error");
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

	const sendCards = async () => {
		setStatus("loading");
		if (cardPoolRef.current.length < 10) await preloadPool();
		let pair = pickTwo();
		if (!pair) {
			await preloadPool();
			pair = pickTwo();
		}
		if (pair) {
			ws.send(JSON.stringify({ type: "set-cards", card1: pair[0], card2: pair[1] }));
		}
	};

	// Animate price reveal
	useEffect(() => {
		if (!roundResult) {
			setAnimatedPrice(0);
			return;
		}
		const target = roundResult.price2;
		const duration = 1000;
		const start = Date.now();
		let raf;
		const animate = () => {
			const progress = Math.min((Date.now() - start) / duration, 1);
			setAnimatedPrice(target * (1 - Math.pow(1 - progress, 3)));
			if (progress < 1) raf = requestAnimationFrame(animate);
			else setAnimatedPrice(target);
		};
		const t = setTimeout(() => {
			raf = requestAnimationFrame(animate);
		}, 10);
		return () => {
			clearTimeout(t);
			if (raf) cancelAnimationFrame(raf);
		};
	}, [roundResult]);

	// WebSocket message handler
	useEffect(() => {
		if (isHost) {
			preloadPool().then(sendCards);
		}

		ws.onmessage = (event) => {
			const msg = JSON.parse(event.data);

			switch (msg.type) {
				case "new-round":
					setCard1(msg.card1);
					setCard2(msg.card2);
					setMyGuess(null);
					setOpponentGuessed(false);
					setRoundResult(null);
					setAnimatedPrice(0);
					setStatus("playing");
					break;

				case "player-guessed":
					if (msg.playerId !== myId) setOpponentGuessed(true);
					break;

				case "round-result":
					setRoundResult(msg);
					setScores(msg.scores.reduce((acc, s) => ({ ...acc, [s.id]: s.score }), {}));
					setStatus("revealing");
					if (isHost) {
						setTimeout(() => sendCards(), 3500);
					}
					break;

				case "player-left":
					setDisconnected(true);
					break;
			}
		};

		ws.onclose = () => setDisconnected(true);

		return () => {
			ws.onmessage = null;
			ws.onclose = null;
		};
	}, []);

	const handleGuess = (guess) => {
		if (myGuess || status !== "playing" || !card1 || !card2) return;
		setMyGuess(guess);
		ws.send(JSON.stringify({ type: "guess", guess }));
	};

	const myResult = roundResult?.guesses?.find((g) => g.id === myId);
	const opponentResult = roundResult?.guesses?.find((g) => g.id !== myId);
	const price1 = roundResult?.price1 ?? card1?.cardmarket?.prices?.averageSellPrice ?? 0;

	const isCorrectGuess = (guess) => {
		if (!roundResult) return null;
		return guess === "more" ? roundResult.price2 > roundResult.price1 : roundResult.price2 < roundResult.price1;
	};

	return (
		<div className="w-screen h-screen bg-black overflow-hidden flex flex-col relative">
			{/* Top bar */}
			<div className="flex items-center justify-between px-8 pt-6 pb-4 flex-shrink-0 z-50">
				<button
					onClick={onBack}
					className="text-white/30 text-[10px] tracking-widest uppercase hover:text-white/70 transition-colors duration-300 cursor-pointer"
				>
					← Leave
				</button>

				{/* Scores */}
				<div className="flex items-center gap-8">
					<div className="text-right">
						<p className="text-white/40 text-[10px] tracking-widest uppercase">{me?.name}</p>
						<p className="text-white text-3xl font-light tabular-nums">{scores[myId] ?? 0}</p>
					</div>
					<div className="text-white/15 text-xs tracking-widest">vs</div>
					<div className="text-left">
						<p className="text-white/40 text-[10px] tracking-widest uppercase">{opponent?.name}</p>
						<p className="text-white text-3xl font-light tabular-nums">{scores[opponent?.id] ?? 0}</p>
					</div>
				</div>

				<p className="text-white/20 text-[10px] tracking-widest uppercase font-mono">{roomCode}</p>
			</div>

			{/* Disconnected overlay */}
			{disconnected && (
				<div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center gap-4">
					<p className="text-white/60 text-sm tracking-wide">Opponent disconnected</p>
					<button
						onClick={onBack}
						className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-8 py-3 rounded-full hover:bg-white hover:text-black transition-all duration-300 cursor-pointer"
					>
						Back to Home
					</button>
				</div>
			)}

			{/* Loading state */}
			{status === "loading" && (
				<div className="flex-1 flex items-center justify-center">
					<p className="text-white/25 text-[10px] tracking-widest uppercase animate-pulse">
						{isHost ? "Loading cards..." : "Waiting for host..."}
					</p>
				</div>
			)}

			{/* Game area */}
			{(status === "playing" || status === "revealing") && card1 && card2 && (
				<div className="flex-1 flex items-center justify-center relative">
					{/* VS Badge */}
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
								<p className="text-white text-xl font-light mt-1">${price1.toFixed(2)}</p>
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

										{/* Show both guesses */}
										<div className="flex gap-6 mt-5">
											{roundResult?.guesses?.map((g) => {
												const correct = isCorrectGuess(g.guess);
												return (
													<div key={g.id} className="flex flex-col items-center gap-1">
														<p className="text-white/30 text-[10px] tracking-widest uppercase">{g.name}</p>
														<p className={`text-sm font-light tracking-wide ${correct ? "text-emerald-400" : "text-red-400/70"}`}>
															{g.guess} {correct ? "✓" : "✗"}
														</p>
													</div>
												);
											})}
										</div>
									</>
								) : (
									<>
										{/* Guess buttons */}
										<div className="flex flex-col items-center gap-2 mt-5">
											<button
												disabled={!!myGuess}
												onClick={() => handleGuess("more")}
												className={`border text-[10px] tracking-widest uppercase px-8 py-2.5 rounded-full transition-all duration-300 w-36 ${
													myGuess === "more"
														? "border-white/60 bg-white text-black cursor-default"
														: "border-white/25 text-white/70 hover:bg-white hover:text-black cursor-pointer"
												} disabled:cursor-default`}
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
												} disabled:cursor-default`}
											>
												Less
											</button>
											<p className="text-white/20 text-[10px] tracking-wider mt-2">than {card1.name}</p>
										</div>

										{/* Opponent status */}
										<div className="flex items-center gap-2 mt-5">
											<div
												className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${opponentGuessed ? "bg-emerald-400" : "bg-white/20 animate-pulse"}`}
											/>
											<p className="text-white/25 text-[10px] tracking-widest uppercase">
												{opponentGuessed ? `${opponent?.name} locked in` : `${opponent?.name} thinking...`}
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
