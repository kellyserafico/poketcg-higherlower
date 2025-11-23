// Map Pokemon types to colors
const getTypeColor = (type) => {
	const typeColors = {
		Normal: "#A8A77A",
		Fire: "#EE8130",
		Water: "#6390F0",
		Electric: "#F7D02C",
		Grass: "#7AC74C",
		Ice: "#96D9D6",
		Fighting: "#C22E28",
		Poison: "#A33EA1",
		Ground: "#E2BF65",
		Flying: "#A98FF3",
		Psychic: "#F95587",
		Bug: "#A6B91A",
		Rock: "#B6A136",
		Ghost: "#735797",
		Dragon: "#6F35FC",
		Dark: "#705746",
		Steel: "#B7B7CE",
		Fairy: "#D685AD",
	};

	return typeColors[type] || "#FFFFFF"; // Default to white if type not found
};

export default function CardContainer({ card }) {
	if (!card || !card.images || !card.images.large) {
		return null;
	}

	// Get the first type from the card's types array, or default to Normal
	const cardType = card.types && card.types.length > 0 ? card.types[0] : "Normal";
	const typeColor = getTypeColor(cardType);

	return (
		<div
			className="border-6 rounded-lg flex flex-col items-start justify-center gap-2 py-4 px-4 overflow-hidden"
			style={{
				borderColor: typeColor,
				width: "100%",
				maxWidth: "700px",
				height: "90vh",
				maxHeight: "800px",
				background: "linear-gradient(180deg, #1A1A3E 0%, #2D2D5A 100%)",
			}}
		>
			<div className="flex flex-row justify-between w-full">
				<div className="flex flex-col">
					<p className="text-xl w-full" style={{ color: typeColor }}>
						{card.name.toUpperCase()}
					</p>
					<p className="text-[10px] text-center text-white px-2 py-1 rounded-md" style={{ backgroundColor: typeColor }}>
						{card.set?.name.toUpperCase()}
					</p>
				</div>
				<div className="w-[100px] flex items-center justify-center bg-[#00000080] border-4 rounded-md border-[#ffffff4d]">
					<p className="text-white text-xs font-bold">
						{card.number || "?"}/{card.set?.total || "?"}
					</p>
				</div>
			</div>

			<div className="flex-1 w-full flex items-center justify-center overflow-hidden">
				<img className="w-full h-full object-contain" src={card.images.large} alt={card.name || "Pokemon card"} />
			</div>
			<div className="m-auto flex flex-col items-center justify-center">
				<p className="text-white">is worth</p>
				<p className="text-yellow-400 font-bold text-2xl">${card.cardmarket?.prices?.averageSellPrice || 0}</p>
			</div>
		</div>
	);
}
