import { useState, useEffect, useRef } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

function App() {
	const [card1, setCard1] = useState(null);
	const [card2, setCard2] = useState(null);
	const [nextCard2, setNextCard2] = useState(null);
	const [result, setResult] = useState(null);
	const [animatedPrice, setAnimatedPrice] = useState(0);
	const [vsFillProgress, setVsFillProgress] = useState(0);
	const [isSliding, setIsSliding] = useState(false);
	const isFetchingRef = useRef(false);
	const vsAnimationFrameRef = useRef(null);
	const vsTimeoutRef = useRef(null);

	// Card cache pool - stores cards in memory for fast access
	const cardPoolRef = useRef([]);
	const isLoadingPoolRef = useRef(false);
	const POOL_SIZE = 200; // Target pool size
	const BATCH_SIZE = 100; // Cards to fetch per API call
	const MIN_POOL_SIZE = 50; // Refill when pool drops below this

	// Fetch a batch of cards from the API
	const fetchCardBatch = async (page = null) => {
		try {
			// If no page specified, use a random page
			const targetPage = page !== null ? page : Math.floor(Math.random() * 100); // ~25k cards / 250 per page = ~100 pages

			const res = await fetch(`https://api.pokemontcg.io/v2/cards?pageSize=${BATCH_SIZE}&page=${targetPage}&q=supertype:pokemon`);

			if (!res.ok) {
				throw new Error(`API error: ${res.status}`);
			}

			const data = await res.json();
			return data.data || [];
		} catch (error) {
			console.error("Error fetching card batch:", error);
			return [];
		}
	};

	// Preload cards into the pool
	const preloadCards = async () => {
		if (isLoadingPoolRef.current) return;

		isLoadingPoolRef.current = true;

		try {
			// Fetch multiple batches in parallel for faster loading
			const batches = await Promise.all([fetchCardBatch(), fetchCardBatch(), fetchCardBatch()]);

			// Flatten and add to pool
			const newCards = batches.flat().filter((card) => card && card.cardmarket?.prices?.averageSellPrice !== undefined);
			cardPoolRef.current = [...cardPoolRef.current, ...newCards];

			// Remove duplicates by card ID
			const uniqueCards = Array.from(new Map(cardPoolRef.current.map((card) => [card.id, card])).values());

			// Limit pool size to prevent memory issues
			if (uniqueCards.length > POOL_SIZE) {
				// Keep the most recent cards
				cardPoolRef.current = uniqueCards.slice(-POOL_SIZE);
			} else {
				cardPoolRef.current = uniqueCards;
			}

			console.log(`Card pool size: ${cardPoolRef.current.length}`);
		} catch (error) {
			console.error("Error preloading cards:", error);
		} finally {
			isLoadingPoolRef.current = false;
		}
	};

	// Get a random card from the pool
	const getRandomCard = () => {
		const pool = cardPoolRef.current;

		if (pool.length === 0) {
			return null;
		}

		const randomIndex = Math.floor(Math.random() * pool.length);
		return pool[randomIndex];
	};

	// Get random cards, refilling pool if needed
	const getRandomCards = async () => {
		// If pool is low, preload more cards in the background
		if (cardPoolRef.current.length < MIN_POOL_SIZE && !isLoadingPoolRef.current) {
			preloadCards();
		}

		// Get cards from pool
		let card1 = getRandomCard();
		let card2 = getRandomCard();

		// Ensure we have two different cards
		while (card2 && card1 && card2.id === card1.id) {
			card2 = getRandomCard();
		}

		// If pool is empty or we don't have enough cards, wait for preload
		if (!card1 || !card2) {
			if (!isLoadingPoolRef.current) {
				await preloadCards();
				card1 = getRandomCard();
				card2 = getRandomCard();
				while (card2 && card1 && card2.id === card1.id) {
					card2 = getRandomCard();
				}
			}
		}

		if (card1 && card2) {
			setCard1(card1);
			setCard2(card2);
			setResult(null);
		}
	};

	const handleGuess = (guess) => {
		if (!card1 || !card2 || isFetchingRef.current) return;

		const price1 = card1.cardmarket?.prices?.averageSellPrice || 0;
		const price2 = card2.cardmarket?.prices?.averageSellPrice || 0;

		const isCorrect = guess === "more" ? price2 > price1 : price2 < price1;

		setResult({
			isCorrect,
			guess,
			price1,
			price2,
		});

		// If correct, handle the transition
		if (isCorrect) {
			isFetchingRef.current = true;

			// Capture card2 value at the moment of the guess
			const currentCard2 = card2;

			// Wait for animations to complete (1s price + 0.8s VS fill = 1.8s) + 0.8s to show checkmark
			const startSlideAnimation = () => {
				// Get new card from pool BEFORE starting animation
				let newCard2 = getRandomCard();

				// Ensure it's different from current card2
				while (newCard2 && newCard2.id === currentCard2.id) {
					newCard2 = getRandomCard();
				}

				// If pool is empty, trigger preload and wait
				if (!newCard2) {
					preloadCards().then(() => {
						newCard2 = getRandomCard();
						while (newCard2 && newCard2.id === currentCard2.id) {
							newCard2 = getRandomCard();
						}
						if (newCard2) {
							// Set the next card 2 so it's ready to slide in
							setNextCard2(newCard2);
							// Start the slide animation
							setIsSliding(true);

							// After slide completes, update cards
							setTimeout(() => {
								// First reset sliding state to prevent transition on new card
								setIsSliding(false);
								// Use requestAnimationFrame to ensure state updates happen after render
								requestAnimationFrame(() => {
									setCard1(currentCard2);
									setCard2(newCard2);
									setNextCard2(null);
									setResult(null);
									isFetchingRef.current = false;
								});
							}, 600); // Slide animation duration
						}
					});
				} else {
					// Set the next card 2 so it's ready to slide in
					setNextCard2(newCard2);
					// Start the slide animation
					setIsSliding(true);

					// After slide completes, update cards
					setTimeout(() => {
						// First reset sliding state to prevent transition on new card
						setIsSliding(false);
						// Use requestAnimationFrame to ensure state updates happen after render
						requestAnimationFrame(() => {
							setCard1(currentCard2);
							setCard2(newCard2);
							setNextCard2(null);
							setResult(null);
							isFetchingRef.current = false;
						});
					}, 600); // Slide animation duration
				}
			};

			// Wait for both animations to complete (1s price + 0.8s VS fill = 1.8s) + 0.8s to show checkmark
			setTimeout(startSlideAnimation, 2600);
		}
	};

	useEffect(() => {
		// Preload cards on mount, then get random cards
		const initialize = async () => {
			await preloadCards();
			await getRandomCards();
		};
		initialize();
	}, []);

	// Animate price from 0 to target price when result is shown
	useEffect(() => {
		if (result && result.price2 !== undefined) {
			setAnimatedPrice(0);
			const targetPrice = result.price2;
			const duration = 1000; // 1 second animation
			let animationFrameId;

			const startTime = Date.now();
			const startPrice = 0;

			const animate = () => {
				const now = Date.now();
				const elapsed = now - startTime;
				const progress = Math.min(elapsed / duration, 1);

				// Easing function for smooth animation
				const easeOutCubic = 1 - Math.pow(1 - progress, 3);
				const currentPrice = startPrice + (targetPrice - startPrice) * easeOutCubic;

				setAnimatedPrice(currentPrice);

				if (progress < 1) {
					animationFrameId = requestAnimationFrame(animate);
				} else {
					setAnimatedPrice(targetPrice);
				}
			};

			// Small delay to ensure state is set
			const timeoutId = setTimeout(() => {
				animationFrameId = requestAnimationFrame(animate);
			}, 10);

			return () => {
				clearTimeout(timeoutId);
				if (animationFrameId) {
					cancelAnimationFrame(animationFrameId);
				}
			};
		} else {
			setAnimatedPrice(0);
		}
	}, [result]);

	// Animate VS circle fill from bottom to top after price animation completes
	useEffect(() => {
		// Cleanup any existing animations
		if (vsTimeoutRef.current) {
			clearTimeout(vsTimeoutRef.current);
			vsTimeoutRef.current = null;
		}
		if (vsAnimationFrameRef.current) {
			cancelAnimationFrame(vsAnimationFrameRef.current);
			vsAnimationFrameRef.current = null;
		}

		if (result && result.isCorrect) {
			// Reset progress first
			setVsFillProgress(0);

			// Wait for price animation to complete (1 second) before starting VS fill
			vsTimeoutRef.current = setTimeout(() => {
				const duration = 800; // 0.8 second fill animation
				const startTime = Date.now();

				const animate = () => {
					const now = Date.now();
					const elapsed = now - startTime;
					const progress = Math.min(elapsed / duration, 1);

					// Easing function for smooth animation
					const easeOutCubic = 1 - Math.pow(1 - progress, 3);
					const currentProgress = easeOutCubic;

					setVsFillProgress(currentProgress);

					if (progress < 1) {
						vsAnimationFrameRef.current = requestAnimationFrame(animate);
					} else {
						setVsFillProgress(1);
						vsAnimationFrameRef.current = null;
					}
				};

				vsAnimationFrameRef.current = requestAnimationFrame(animate);
			}, 1000); // Start after price animation completes
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

	// Calculate correct answer for debugging
	const price1 = card1?.cardmarket?.prices?.averageSellPrice || 0;
	const price2 = card2?.cardmarket?.prices?.averageSellPrice || 0;
	const correctAnswer = price1 && price2 ? (price2 > price1 ? "More" : "Less") : null;

	return (
		<>
			{/* Debug Container */}
			{card1 && card2 && (
				<div className="fixed top-4 left-4 bg-black bg-opacity-80 text-white p-4 rounded-lg border-2 border-yellow-500 z-50 text-sm font-mono">
					<div className="font-bold text-yellow-400 mb-2">DEBUG INFO</div>
					<div>Card 1: ${price1.toFixed(2)}</div>
					<div>Card 2: ${price2.toFixed(2)}</div>
					<div className="mt-2 pt-2 border-t border-yellow-500">
						<div className="font-bold">
							Correct Answer: <span className="text-green-400">{correctAnswer}</span>
						</div>
						{result && (
							<div className="mt-2">
								VS Fill: <span className="text-blue-400">{(vsFillProgress * 100).toFixed(1)}%</span>
								{result.isCorrect && (
									<div className="mt-1">
										VS Opacity:{" "}
										<span className="text-purple-400">
											{vsFillProgress >= 0.15 ? (Math.max(0, 1 - (vsFillProgress - 0.15) / 0.85) * 100).toFixed(0) : 100}%
										</span>
									</div>
								)}
								{result.isCorrect && vsFillProgress >= 1 && (
									<span className="text-green-400 ml-2">✓ Checkmark should be visible</span>
								)}
							</div>
						)}
					</div>
				</div>
			)}
			<div className="relative flex flex-row w-screen h-screen fixed inset-0 overflow-hidden">
				{/* VS Badge */}
				{card1 && card2 && (
					<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 rounded-full w-20 h-20 flex items-center justify-center shadow-lg overflow-hidden">
						{/* Background circle */}
						<div className="absolute inset-0 bg-white rounded-full z-0"></div>
						{/* Green fill animation - fills from bottom to top */}
						{result && result.isCorrect && (
							<div
								className="absolute inset-0 bg-green-500 z-[1] rounded-full"
								style={{
									clipPath: `inset(${100 - vsFillProgress * 100}% 0 0 0)`,
								}}
							></div>
						)}
						{/* VS text - fades out starting at 15% fill */}
						{!(result && result.isCorrect && vsFillProgress >= 1) && (
							<span
								className="relative z-[2] text-black font-bold text-2xl"
								style={{
									opacity:
										result && result.isCorrect && vsFillProgress >= 0.15
											? Math.max(0, 1 - (vsFillProgress - 0.15) / 0.85) // Fade from 1 to 0 between 15% and 100%
											: 1,
									transition: "opacity 0.3s ease-out",
								}}
							>
								VS
							</span>
						)}
						{/* Checkmark - fades in when circle is fully green, positioned absolutely to not affect VS text */}
						{result && result.isCorrect && (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="32"
								height="32"
								viewBox="0 0 24 24"
								fill="none"
								stroke="white"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="absolute inset-0 m-auto z-[2] transition-opacity duration-500"
								style={{
									opacity: vsFillProgress >= 1 ? 1 : 0,
									pointerEvents: "none",
									width: "32px",
									height: "32px",
								}}
							>
								<path d="M20 6 9 17l-5-5" />
							</svg>
						)}
					</div>
				)}
				<div className="relative w-1/2 h-full flex items-center justify-center bg-gray-900 transition-all duration-500 ease-in-out">
					{card1 && (
						<>
							<img
								className="w-full h-full object-contain brightness-50 transition-all duration-500"
								src={card1.images.large}
								alt={card1.name}
							/>
							<div className="absolute inset-0 flex flex-col justify-center items-center gap-2 z-10 transition-opacity duration-500">
								<p className="text-white text-4xl font-bold">{card1.name}</p>
								<p className="text-white">{card1.set?.name}</p>
								<p className="text-white">is worth</p>
								<p className="text-white">${card1.cardmarket?.prices?.averageSellPrice || 0}</p>
							</div>
						</>
					)}
				</div>
				<div className="relative w-1/2 h-full flex items-center justify-center bg-gray-900 transition-all duration-500 ease-in-out overflow-visible">
					{/* Current card 2 - slides to the left to card 1's position */}
					{card2 && (
						<div
							className="absolute inset-0 w-full h-full"
							style={{
								transform: isSliding ? "translateX(-50vw)" : "translateX(0)",
								transition: isSliding ? "transform 0.6s ease-in-out" : "none",
							}}
						>
							<img
								className="w-full h-full object-contain brightness-50 transition-all duration-500"
								src={card2.images.large}
								alt={card2.name}
							/>
							{card1 && (
								<div className="absolute inset-0 flex flex-col justify-center items-center gap-2 z-10">
									<p className="text-white text-4xl font-bold">{card2.name}</p>
									<p className="text-white">{card2.set?.name}</p>
									<p className="text-white">is worth</p>
									{result ? (
										<>
											<p className={`text-2xl font-bold ${result.isCorrect ? "text-green-400" : "text-red-400"}`}>
												${animatedPrice.toFixed(2)}
											</p>
											{!result.isCorrect && (
												<button
													className="text-white rounded-full border-3 border-white py-4 px-8 cursor-pointer hover:bg-white hover:text-black transition-colors mt-4"
													onClick={() => getRandomCards()}
												>
													Play Again
												</button>
											)}
										</>
									) : (
										<>
											<button
												className="text-white rounded-full border-3 border-white py-4 px-8 cursor-pointer hover:bg-white hover:text-black transition-colors"
												onClick={() => handleGuess("more")}
											>
												More
											</button>
											<button
												className="text-white rounded-full border-3 border-white py-4 px-8 cursor-pointer hover:bg-white hover:text-black transition-colors"
												onClick={() => handleGuess("less")}
											>
												Less
											</button>
											<p className="text-white">than {card1.name}</p>
										</>
									)}
								</div>
							)}
						</div>
					)}
					{/* Next card 2 - slides in from the right */}
					{nextCard2 && (
						<div
							className="absolute inset-0 w-full h-full"
							style={{
								transform: isSliding ? "translateX(0)" : "translateX(100%)",
								transition: isSliding ? "transform 0.6s ease-in-out" : "none",
							}}
						>
							<img
								className="w-full h-full object-contain brightness-50 transition-all duration-500"
								src={nextCard2.images.large}
								alt={nextCard2.name}
							/>
							<div className="absolute inset-0 flex flex-col justify-center items-center gap-2 z-10">
								<p className="text-white text-4xl font-bold">{nextCard2.name}</p>
								<p className="text-white">{nextCard2.set?.name}</p>
								<p className="text-white">is worth</p>
								<>
									<button
										className="text-white rounded-full border-3 border-white py-4 px-8 cursor-pointer hover:bg-white hover:text-black transition-colors"
										onClick={() => handleGuess("more")}
									>
										More
									</button>
									<button
										className="text-white rounded-full border-3 border-white py-4 px-8 cursor-pointer hover:bg-white hover:text-black transition-colors"
										onClick={() => handleGuess("less")}
									>
										Less
									</button>
									<p className="text-white">than {card1?.name}</p>
								</>
							</div>
						</div>
					)}
				</div>
			</div>
		</>
	);
}

export default App;
