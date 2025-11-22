// Map Pokemon types to colors
const getTypeColor = (type) => {
	const typeColors = {
		Fire: "#FF6B35",
		Water: "#4A90E2",
		Grass: "#7CB342",
		Electric: "#FFD700",
		Psychic: "#9C27B0",
		Ice: "#81D4FA",
		Dragon: "#6A1B9A",
		Dark: "#424242",
		Fairy: "#F48FB1",
		Normal: "#A8A878",
		Fighting: "#C03028",
		Flying: "#A890F0",
		Poison: "#A040A0",
		Ground: "#E0C068",
		Rock: "#B8A038",
		Bug: "#A8B820",
		Ghost: "#705898",
		Steel: "#B8B8D0",
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
			className="border-6 rounded-lg flex flex-col items-start justify-center gap-2 py-4 px-4"
			style={{ borderColor: typeColor }}
		>
			<p className="text-xl text-center" style={{ color: typeColor }}>
				{card.name.toUpperCase()}
			</p>
			<p className="text-[10px] text-center text-white px-2 py-1 rounded-md" style={{ backgroundColor: typeColor }}>
				{card.set?.name.toUpperCase()}
			</p>

			<img
				className="w-full transition-all duration-500 object-contain mx-auto"
				src={card.images.large}
				alt={card.name || "Pokemon card"}
			/>
		</div>
	);
}
