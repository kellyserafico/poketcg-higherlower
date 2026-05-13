import { useState, useEffect } from "react";

export default function HomePage({ onSelectSet, onMultiplayer }) {
	const [sets, setSets] = useState([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");

	useEffect(() => {
		fetch("https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250")
			.then((r) => r.json())
			.then((data) => {
				setSets(data.data || []);
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, []);

	const filtered = search
		? sets.filter(
				(s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.series.toLowerCase().includes(search.toLowerCase()),
			)
		: sets;

	return (
		<div className="min-h-screen bg-black text-white flex flex-col">
			{/* Header */}
			<div className="text-center pt-20 pb-10 flex-shrink-0">
				<p className="text-white/30 text-[10px] tracking-widest uppercase mb-4">Pokémon TCG</p>
				<h1 className="text-5xl font-light tracking-wide">Higher or Lower</h1>
				<p className="text-white/25 text-xs tracking-wide mt-4">Choose a set, or play with all cards</p>
				<div className="flex items-center justify-center gap-4 mt-8">
					<button
						className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-10 py-3 rounded-full hover:bg-white hover:text-black transition-all duration-300 cursor-pointer"
						onClick={() => onSelectSet(null)}
					>
						Play All Sets
					</button>
					<button
						className="border border-white/25 text-white/70 text-[10px] tracking-widest uppercase px-10 py-3 rounded-full hover:bg-white hover:text-black transition-all duration-300 cursor-pointer"
						onClick={onMultiplayer}
					>
						Multiplayer
					</button>
				</div>
			</div>

			{/* Search */}
			<div className="px-12 pb-6 flex-shrink-0 max-w-2xl mx-auto w-full">
				<input
					type="text"
					placeholder="Search sets or series..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="w-full bg-transparent border border-white/15 text-white text-xs placeholder-white/25 px-5 py-3 rounded-full focus:outline-none focus:border-white/35 tracking-wide transition-colors"
				/>
			</div>

			{/* Sets grid */}
			<div className="flex-1 px-12 pb-16">
				{loading ? (
					<div className="flex items-center justify-center h-64">
						<p className="text-white/25 text-[10px] tracking-widest uppercase animate-pulse">Loading sets...</p>
					</div>
				) : (
					<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
						{filtered.map((set) => (
							<button
								key={set.id}
								onClick={() => onSelectSet(set)}
								className="flex flex-col items-center gap-3 p-4 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group text-left"
							>
								{set.images?.logo ? (
									<img
										src={set.images.logo}
										alt={set.name}
										className="h-20 w-full object-contain opacity-95 group-hover:opacity-100 transition-opacity duration-300"
									/>
								) : (
									<div className="h-20 w-full flex items-center justify-center">
										<p className="text-white/30 text-xs text-center">{set.name}</p>
									</div>
								)}
								<div className="text-center">
									<p className="text-white/70 text-[11px] font-light leading-snug">{set.name}</p>
									<p className="text-white/25 text-[10px] tracking-wider mt-0.5">{set.total} cards</p>
								</div>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
