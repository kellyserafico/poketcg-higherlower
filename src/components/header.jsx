import ScoreContainer from "./scoreContainer";
import { StarIcon } from "lucide-react";
import { TrophyIcon } from "lucide-react";
export default function Header({ score, highScore }) {
	return (
		<div
			className="flex flex-row justify-between items-center fixed top-0 left-0 right-0 z-50 p-4"
			style={{ background: "linear-gradient(180deg, #5865F2 0%, #7B68EE 100%)" }}
		>
			<h1 className="text-2xl font-bold text-white">POKETCG HIGHER LOWER</h1>
			<div className="flex flex-row gap-4">
				<ScoreContainer score={score} label="Score" borderColor="#FFCC00" icon={<StarIcon className="" />} />
				<ScoreContainer score={highScore} label="High Score" borderColor="#FF6B6B" icon={<TrophyIcon className="" />} />
			</div>
		</div>
	);
}
