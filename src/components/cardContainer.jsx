export default function CardContainer({ card }) {
	if (!card || !card.images || !card.images.large) {
		return null;
	}

	return (
		<div className="border-6border-red">
			<img
				className="w-full h-full object-contain brightness-50 transition-all duration-500"
				src={card.images.large}
				alt={card.name || "Pokemon card"}
			/>
		</div>
	);
}
