import { cloneElement } from "react";

export default function ScoreContainer({ score, label, borderColor, icon = null }) {
	const iconColor = borderColor || "#FFFFFF";
	const styledIcon = icon ? cloneElement(icon, { color: iconColor, fill: iconColor }) : null;

	return (
		<div
			className="flex flex-row gap-2 border-3 rounded-md bg-[#1A1A3E] py-3 px-4 items-center justify-center"
			style={{ borderColor: borderColor || "#FFFFFF" }}
		>
			<div className="flex items-center justify-center" style={{ color: borderColor || "#FFFFFF" }}>
				{styledIcon}
			</div>

			<div className="text-sm flex flex-col justify-center" style={{ color: borderColor || "#FFFFFF" }}>
				<p className="text-[10px]">{label.toUpperCase()}</p>
				<p className="text-white">{score}</p>
			</div>
		</div>
	);
}
