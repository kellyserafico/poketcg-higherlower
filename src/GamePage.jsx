import { useState, useEffect, useRef } from "react";

export default function GamePage({ selectedSet, onBack }) {
	const [card1, setCard1] = useState(null);
	const [card2, setCard2] = useState(null);
	const [nextCard2, setNextCard2] = useState(null);
	const [result, setResult] = useState(null);
	const [animatedPrice, setAnimatedPrice] = useState(0);
	const [vsFillProgress, setVsFillProgress] = useState(0);
	const [isSliding, setIsSliding] = useState(false);
	const [score, setScore] = useState(0);
	const [highScore, setHighScore] = useState(() => {
		const saved = localStorage.getItem("poketcg-highscore");
		return saved ? parseInt(saved, 10) : 0;
	});
	const isFetchingRef = useRef(false);
	const vsAnimationFrameRef = useRef(null);
	const vsTimeoutRef = useRef(null);

	const cardPoolRef = useRef([]);
	const isLoadingPoolRef = useRef(false);
	const POOL_SIZE = 200;
	const BATCH_SIZE = 100;
	const MIN_POOL_SIZE = 50;

	const fetchCardBatch = async (page = null) => {
		try {
			const setFilter = selectedSet ? ` set.id:${selectedSet.id}` : "";
			const maxPage = selectedSet ? Math.ceil(selectedSet.total / BATCH_SIZE) || 1 : 100;
			const targetPage = page !== null ? page : Math.floor(Math.random() * maxPage) + 1;
			const res = await fetch(
				`https://api.pokemontcg.io/v2/cards?pageSize=${BATCH_SIZE}&page=${targetPage}&q=supertype:pokemon${setFilter}`,
			);
			if (!res.ok) throw new Error(`API error: ${res.status}`);
			const data = await res.json();
			return data.data || [];
		} catch (error) {
			console.error("Error fetching card batch:", error);
			return [];
		}
	};

	const preloadCards = async () => {
		if (isLoadingPoolRef.current) return;
		isLoadingPoolRef.current = true;
		try {
			const batches = selectedSet
				? await Promise.all([fetchCardBatch(1), fetchCardBatch(2)])
				: await Promise.all([fetchCardBatch(), fetchCardBatch(), fetchCardBatch()]);
			const newCards = batches.flat().filter((card) => card && card.cardmarket?.prices?.averageSellPrice !== undefined);
			cardPoolRef.current = [...cardPoolRef.current, ...newCards];
			const uniqueCards = Array.from(new Map(cardPoolRef.current.map((card) => [card.id, card])).values());
			cardPoolRef.current = uniqueCards.length > POOL_SIZE ? uniqueCards.slice(-POOL_SIZE) : uniqueCards;
		} catch (error) {
			console.error("Error preloading cards:", error);
		} finally {
			isLoadingPoolRef.current = false;
		}
	};

	const getRandomCard = () => {
		const pool = cardPoolRef.current;
		if (pool.length === 0) return null;
		return pool[Math.floor(Math.random() * pool.length)];
	};

	const preloadImage = (src) => {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = reject;
			img.src = src;
		});
	};

	const getRandomCards = async () => {
		if (cardPoolRef.current.length < MIN_POOL_SIZE && !isLoadingPoolRef.current) preloadCards();
		let c1 = getRandomCard();
		let c2 = getRandomCard();
		while (c2 && c1 && c2.id === c1.id) c2 = getRandomCard();
		if (!c1 || !c2) {
			if (!isLoadingPoolRef.current) {
				await preloadCards();
				c1 = getRandomCard();
				c2 = getRandomCard();
				while (c2 && c1 && c2.id === c1.id) c2 = getRandomCard();
			}
		}
		if (c1 && c2) {
			setCard1(c1);
			setCard2(c2);
			setResult(null);
		}
	};

	const handleGuess = (guess) => {
		if (!card1 || !card2 || isFetchingRef.current) return;
		const price1 = card1.cardmarket?.prices?.averageSellPrice || 0;
		const price2 = card2.cardmarket?.prices?.averageSellPrice || 0;
		const isCorrect = guess === "more" ? price2 > price1 : price2 < price1;
		setResult({ isCorrect, guess, price1, price2 });
		if (isCorrect) {
			setScore((prevScore) => {
				const newScore = prevScore + 1;
				const currentHighScore = parseInt(localStorage.getItem("poketcg-highscore") || "0", 10);
				if (newScore > currentHighScore) {
					setHighScore(newScore);
					localStorage.setItem("poketcg-highscore", newScore.toString());
				}
				return newScore;
			});
			isFetchingRef.current = true;
			const currentCard2 = card2;
			const startSlideAnimation = async () => {
				let newCard2 = getRandomCard();
				while (newCard2 && newCard2.id === currentCard2.id) newCard2 = getRandomCard();
				if (!newCard2) {
					await preloadCards();
					newCard2 = getRandomCard();
					while (newCard2 && newCard2.id === currentCard2.id) newCard2 = getRandomCard();
				}
				if (newCard2) {
					try {
						await preloadImage(newCard2.images.large);
					} catch (e) {
						/* continue */
					}
					setNextCard2(newCard2);
					setIsSliding(true);
					setTimeout(() => {
						setCard1(currentCard2);
						setCard2(newCard2);
						setResult(null);
						setIsSliding(false);
						setNextCard2(null);
						isFetchingRef.current = false;
					}, 600);
				}
			};
			setTimeout(startSlideAnimation, 2600);
		}
	};

	useEffect(() => {
		cardPoolRef.current = [];
		const initialize = async () => {
			await preloadCards();
			await getRandomCards();
		};
		initialize();
	}, []);

	useEffect(() => {
		if (result && result.price2 !== undefined) {
			setAnimatedPrice(0);
			const targetPrice = result.price2;
			const duration = 1000;
			let animationFrameId;
			const startTime = Date.now();
			const animate = () => {
				const progress = Math.min((Date.now() - startTime) / duration, 1);
				setAnimatedPrice(targetPrice * (1 - Math.pow(1 - progress, 3)));
				if (progress < 1) {
					animationFrameId = requestAnimationFrame(animate);
				} else {
					setAnimatedPrice(targetPrice);
				}
			};
			const timeoutId = setTimeout(() => {
				animationFrameId = requestAnimationFrame(animate);
			}, 10);
			return () => {
				clearTimeout(timeoutId);
				if (animationFrameId) cancelAnimationFrame(animationFrameId);
			};
		} else {
			setAnimatedPrice(0);
		}
	}, [result]);

	useEffect(() => {
		if (vsTimeoutRef.current) {
			clearTimeout(vsTimeoutRef.current);
			vsTimeoutRef.current = null;
		}
		if (vsAnimationFrameRef.current) {
			cancelAnimationFrame(vsAnimationFrameRef.current);
			vsAnimationFrameRef.current = null;
		}
		if (result && result.isCorrect) {
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
	}, [result]);

	const CardInfo = ({ card, children }) => (
		<div className="flex flex-col items-center gap-1 text-center mt-4">
			<p className="text-white/30 text-[10px] tracking-widest uppercase">{card.set?.name}</p>
			<p className="text-white text-lg font-light mt-1">{card.name}</p>
			<div className="flex flex-col items-center min-h-[160px]">{children}</div>
		</div>
	);

	const GuessButtons = ({ compareTo }) => (
		<div className="flex flex-col items-center gap-2 mt-5">
			<button
				className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-8 py-2.5 rounded-full hover:bg-white hover:text-black transition-all duration-300 cursor-pointer w-36"
				onClick={() => handleGuess("more")}
			>
				More
			</button>
			<button
				className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-8 py-2.5 rounded-full hover:bg-white hover:text-black transition-all duration-300 cursor-pointer w-36"
				onClick={() => handleGuess("less")}
			>
				Less
			</button>
			{compareTo && <p className="text-white/20 text-[10px] tracking-wider mt-2">than {compareTo}</p>}
		</div>
	);

	return (
		<div className="w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center relative">
			{/* Back button */}
			<button
				onClick={onBack}
				className="fixed top-6 left-8 z-50 text-white/30 text-[10px] tracking-widest uppercase hover:text-white/70 transition-colors duration-300 cursor-pointer"
			>
				← Sets
			</button>

			{/* Set name */}
			{selectedSet && (
				<div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
					<p className="text-white/20 text-[10px] tracking-widest uppercase">{selectedSet.name}</p>
				</div>
			)}

			{/* Score */}
			<div className="fixed top-6 right-8 z-50 text-right pointer-events-none select-none">
				<div className="text-white text-4xl font-light tabular-nums">{score}</div>
				<div className="text-white/25 text-[10px] tracking-widest uppercase mt-1">best {highScore}</div>
			</div>

			{/* VS Badge */}
			{card1 && card2 && (
				<div
					className="absolute z-30 rounded-full w-12 h-12 flex items-center justify-center overflow-hidden shadow-2xl"
					style={{ marginTop: "-8rem" }}
				>
					<div className="absolute inset-0 bg-white rounded-full z-0" />
					{result && result.isCorrect && (
						<div
							className="absolute inset-0 bg-emerald-400 z-[1] rounded-full"
							style={{ clipPath: `inset(${100 - vsFillProgress * 100}% 0 0 0)` }}
						/>
					)}
					{!(result && result.isCorrect && vsFillProgress >= 1) && (
						<span
							className="relative z-[2] text-black font-medium text-[10px] tracking-widest uppercase"
							style={{
								opacity:
									result && result.isCorrect && vsFillProgress >= 0.15 ? Math.max(0, 1 - (vsFillProgress - 0.15) / 0.85) : 1,
								transition: "opacity 0.3s ease-out",
							}}
						>
							vs
						</span>
					)}
					{result && result.isCorrect && (
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="white"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="absolute inset-0 m-auto z-[2] transition-opacity duration-500"
							style={{ opacity: vsFillProgress >= 1 ? 1 : 0, pointerEvents: "none" }}
						>
							<path d="M20 6 9 17l-5-5" />
						</svg>
					)}
				</div>
			)}

			{/* Cards row */}
			<div className="flex items-start gap-28 relative">
				{/* Card 1 */}
				<div className="flex flex-col items-center w-96">
					{card1 && (
						<>
							<img className="w-full h-auto rounded-xl shadow-2xl" src={card1.images.large} alt={card1.name} />
							<CardInfo card={card1}>
								<p className="text-white/25 text-[10px] tracking-widest uppercase mt-4">avg. sell price</p>
								<p className="text-white text-xl font-light mt-1">
									${(card1.cardmarket?.prices?.averageSellPrice || 0).toFixed(2)}
								</p>
							</CardInfo>
						</>
					)}
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
							{card1 &&
								(result ? (
									<CardInfo card={card2}>
										<p className="text-white/25 text-[10px] tracking-widest uppercase mt-4">avg. sell price</p>
										<p className="text-white text-xl font-light mt-1">${animatedPrice.toFixed(2)}</p>
										{!result.isCorrect && (
											<button
												className="mt-6 border border-white/25 text-white/60 text-[10px] tracking-widest uppercase px-8 py-2.5 rounded-full hover:bg-white hover:text-black transition-all duration-300 cursor-pointer"
												onClick={() => {
													setScore(0);
													getRandomCards();
												}}
											>
												Play Again
											</button>
										)}
									</CardInfo>
								) : (
									<CardInfo card={card2}>
										<GuessButtons compareTo={card1.name} />
									</CardInfo>
								))}
						</div>
					)}

					{/* Next card sliding in from right */}
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
							<CardInfo card={nextCard2}>
								<GuessButtons compareTo={card1?.name} />
							</CardInfo>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
