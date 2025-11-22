import ScoreContainer from "./scoreContainer";
import { StarIcon } from "lucide-react";
import { TrophyIcon } from "lucide-react";
export default function Header({ score, highScore }) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "row",
				justifyContent: "space-between",
				alignItems: "center",
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				zIndex: 50,
				padding: "16px",
				backgroundColor: "#5865F2",
			}}
		>
			<h1 className="text-2xl font-bold">PokéTCG Higher Lower</h1>
			<div className="flex flex-row gap-4">
				<ScoreContainer score={score} label="Score" borderColor="#FFCC00" icon={<StarIcon className="" />} />
				<ScoreContainer score={highScore} label="High Score" borderColor="#FF6B6B" icon={<TrophyIcon className="" />} />
			</div>
		</div>
	);
}
