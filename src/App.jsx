import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { useEffect } from "react";

function App() {
	const [card1, setCard1] = useState(null);
	const [card2, setCard2] = useState(null);
	const [result, setResult] = useState(null);

	const getRandomCards = async () => {
		const randomPage1 = Math.floor(Math.random() * 100) + 1;
		const randomPage2 = Math.floor(Math.random() * 100) + 1;

		const [res1, res2] = await Promise.all([
			fetch(`https://api.pokemontcg.io/v2/cards?page=${randomPage1}&pageSize=1&q=supertype:pokemon`),
			fetch(`https://api.pokemontcg.io/v2/cards?page=${randomPage2}&pageSize=1&q=supertype:pokemon`),
		]);

		const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

		console.log(data1.data[0]);
		console.log(data2.data[0]);
		setCard1(data1.data[0]);
		setCard2(data2.data[0]);
		setResult(null);
	};

	const handleGuess = (guess) => {
		if (!card1 || !card2) return;

		const price1 = card1.cardmarket?.prices?.averageSellPrice || 0;
		const price2 = card2.cardmarket?.prices?.averageSellPrice || 0;

		const isCorrect = guess === "more" ? price2 > price1 : price2 < price1;

		setResult({
			isCorrect,
			guess,
			price1,
			price2,
		});
	};

	useEffect(() => {
		getRandomCards();
	}, []);

	return (
		<>
			<div className="flex flex-row w-screen h-screen fixed inset-0">
				<div className="relative w-1/2 h-full flex items-center justify-center bg-gray-900">
					{card1 && <img className="w-full h-full object-contain brightness-50" src={card1.images.large} alt={card1.name} />}
					{card1 && (
						<div className="absolute inset-0 flex flex-col justify-center items-center gap-2 z-10">
							<p className="text-white text-4xl font-bold">{card1.name}</p>
							<p className="text-white">{card1.set?.name}</p>
							<p className="text-white">is worth</p>
							<p className="text-white">${card1.cardmarket?.prices?.averageSellPrice || 0}</p>
						</div>
					)}
				</div>
				<div className="relative w-1/2 h-full flex items-center justify-center bg-gray-900">
					{card2 && <img className="w-full h-full object-contain brightness-50" src={card2.images.large} alt={card2.name} />}
					{card2 && card1 && (
						<div className="absolute inset-0 flex flex-col justify-center items-center gap-2 z-10">
							<p className="text-white text-4xl font-bold">{card2.name}</p>
							<p className="text-white">{card2.set?.name}</p>
							<p className="text-white">is worth</p>
							{result ? (
								<>
									<p className={`text-2xl font-bold ${result.isCorrect ? "text-green-400" : "text-red-400"}`}>${result.price2}</p>
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
