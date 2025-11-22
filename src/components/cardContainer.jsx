export default function CardContainer({
	card,
	position = "left",
	result,
	animatedPrice,
	handleGuess,
	isSliding = false,
	nextCard = null,
	card1 = null,
	getRandomCards,
	setScore,
}) {
	// Helper function to render a single card in the retro style
	const renderCard = (cardData, showPrice = false, showButtons = false, showResult = false) => {
		if (!cardData) return null;

		const price = cardData.cardmarket?.prices?.averageSellPrice || 0;

		return (
			<div className="relative w-[400px] h-[600px] rounded-lg border-4 border-[#FB2C36] bg-[#0F0F23] p-4 flex flex-col shadow-2xl">
				{/* Header Section */}
				<div className="flex justify-between items-start mb-3">
					<div className="flex-1">
						<h2 className="text-white text-base leading-tight mb-2">{cardData.name.toUpperCase()}</h2>
						<div className="bg-[#FB2C36] px-3 py-1.5 inline-block rounded"></div>
					</div>
				</div>

				{/* Main Image Area */}
				<div className="flex-1 relative mb-4 rounded overflow-hidden bg-[#1a1a3a] flex items-center justify-center">
					<img className="w-full h-full object-contain" src={cardData.images.large} alt={cardData.name} />
				</div>

				{/* Price/Result Display */}
				{showPrice && !showButtons && (
					<div className="mt-3 text-center">
						{showResult && result ? (
							<>
								<p className={`text-xl font-bold mb-3 ${result.isCorrect ? "text-green-400" : "text-red-400"}`}>
									${animatedPrice.toFixed(2)}
								</p>
								{!result.isCorrect && (
									<button
										className="bg-[#FB2C36] text-white px-6 py-2 rounded border-2 border-white hover:bg-white hover:text-[#FB2C36] transition-colors text-sm"
										onClick={() => {
											setScore(0);
											getRandomCards();
										}}
									>
										Play Again
									</button>
								)}
							</>
						) : (
							<p className="text-white text-sm">${price.toFixed(2)}</p>
						)}
					</div>
				)}

				{/* Buttons */}
				{showButtons && card1 && (
					<div className="mt-3 flex flex-col gap-2">
						<button
							className="bg-[#FB2C36] text-white px-6 py-3 rounded border-2 border-white hover:bg-white hover:text-[#FB2C36] transition-colors text-sm"
							onClick={() => handleGuess("more")}
						>
							More
						</button>
						<button
							className="bg-[#FB2C36] text-white px-6 py-3 rounded border-2 border-white hover:bg-white hover:text-[#FB2C36] transition-colors text-sm"
							onClick={() => handleGuess("less")}
						>
							Less
						</button>
						<p className="text-white text-xs text-center mt-1">than {card1.name}</p>
					</div>
				)}
			</div>
		);
	};

	if (position === "left") {
		// Left card - static display
		if (!card) return null;

		return (
			<div
				style={{
					position: "relative",
					width: "50%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					transition: "all 0.5s ease-in-out",
					padding: "32px",
				}}
			>
				{renderCard(card, true)}
			</div>
		);
	}

	// Right card - with sliding animation
	return (
		<div
			style={{
				position: "relative",
				width: "50%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				transition: "all 0.5s ease-in-out",
				overflow: "visible",
				padding: "32px",
			}}
		>
			{/* Current card 2 - slides to the left to card 1's position */}
			{card && (
				<div
					key={card.id}
					style={{
						position: "absolute",
						inset: 0,
						width: "100%",
						height: "100%",
						zIndex: 10,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						padding: "32px",
						transform: isSliding ? "translateX(-50vw)" : "translateX(0)",
						transition: isSliding ? "transform 0.6s ease-in-out" : "none",
					}}
				>
					{renderCard(card, true, !result, !!result)}
				</div>
			)}
			{/* Next card 2 - slides in from the right */}
			{nextCard && (
				<div
					key={nextCard.id}
					style={{
						position: "absolute",
						inset: 0,
						width: "100%",
						height: "100%",
						zIndex: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						padding: "32px",
						transform: isSliding ? "translateX(0)" : "translateX(100%)",
						transition: isSliding ? "transform 0.6s ease-in-out" : "none",
					}}
				>
					{renderCard(nextCard, false, true, false)}
				</div>
			)}
		</div>
	);
}
