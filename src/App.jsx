import { useState, useEffect, useRef } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

function App() {
	const [card1, setCard1] = useState(null);
	const [card2, setCard2] = useState(null);
	const [result, setResult] = useState(null);
	const [animatedPrice, setAnimatedPrice] = useState(0);
	const isFetchingRef = useRef(false);

	const getRandomCard = async () => {
		const offset = Math.floor(Math.random() * 25000); // total card count ~25k
		const res = await fetch(`https://api.pokemontcg.io/v2/cards?pageSize=1&page=${Math.floor(offset / 250)}&q=supertype:pokemon`);
		const data = await res.json();
		return data.data[0];
	};

	const getRandomCards = async () => {
		const offset1 = Math.floor(Math.random() * 25000); // total card count ~25k
		const offset2 = Math.floor(Math.random() * 25000); // total card count ~25k
    
		const [res1, res2] = await Promise.all([
			fetch(`https://api.pokemontcg.io/v2/cards?pageSize=1&page=${Math.floor(offset1 / 250)}&q=supertype:pokemon`),
			fetch(`https://api.pokemontcg.io/v2/cards?pageSize=1&page=${Math.floor(offset2 / 250)}&q=supertype:pokemon`),
		]);

		const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

		console.log(data1.data[0]);
		console.log(data2.data[0]);
		setCard1(data1.data[0]);
		setCard2(data2.data[0]);
		setResult(null);

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

			// Wait for animation to play (at least 1 second)
			const transitionAfterAnimation = () => {
				getRandomCard().then((newCard2) => {
					setCard1(currentCard2);
					setCard2(newCard2);
					setResult(null);
					isFetchingRef.current = false;
				});
			};

			// Wait for animation to complete (1 second) before transitioning
			setTimeout(transitionAfterAnimation, 1000);
		}
	};

	useEffect(() => {
		getRandomCards();
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
					</div>
				</div>
			)}
			<div className="flex flex-row w-screen h-screen fixed inset-0">
				<div className="relative w-1/2 h-full flex items-center justify-center bg-gray-900 transition-all duration-500 ease-in-out">
					{card1 && (
						<img
							className="w-full h-full object-contain brightness-50 transition-all duration-500"
							src={card1.images.large}
							alt={card1.name}
						/>
					)}
					{card1 && (
						<div className="absolute inset-0 flex flex-col justify-center items-center gap-2 z-10 transition-opacity duration-500">
							<p className="text-white text-4xl font-bold">{card1.name}</p>
							<p className="text-white">{card1.set?.name}</p>
							<p className="text-white">is worth</p>
							<p className="text-white">${card1.cardmarket?.prices?.averageSellPrice || 0}</p>
						</div>
					)}
				</div>
				<div className="relative w-1/2 h-full flex items-center justify-center bg-gray-900 transition-all duration-500 ease-in-out">
					{card2 && (
						<img
							className="w-full h-full object-contain brightness-50 transition-all duration-500"
							src={card2.images.large}
							alt={card2.name}
						/>
					)}
					{card2 && card1 && (
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
			</div>
		</>
	);
}

export default App;
