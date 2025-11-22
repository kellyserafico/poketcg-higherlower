export default function CardContainer({ card }) {
	if (!card || !card.images || !card.images.large) {
		return null;
	}

	return (
		<div className="border-6 flex flex-col items-center justify-center gap-2">
			<img className="w-1/2 h-1/2 transition-all duration-500" src={card.images.large} alt={card.name || "Pokemon card"} />
			<div className="text-white text-sm text-center">{card.name}</div>
		</div>
	);
}
