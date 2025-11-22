import { cloneElement } from "react";

export default function ScoreContainer({ score, label, borderColor, icon = null }) {
	const iconColor = borderColor || "#FFFFFF";
	const styledIcon = icon ? cloneElement(icon, { color: iconColor, fill: iconColor }) : null;

	return (
		<div className="flex flex-row gap-2 border-2 rounded-md p-2 bg-[#1A1A3E]" style={{ borderColor: borderColor || "#FFFFFF" }}>
			<div className="text-2xl font-bold" style={{ color: borderColor || "#FFFFFF" }}>
				{styledIcon} {score}
			</div>
			<div>
				<div className="text-sm" style={{ color: borderColor || "#FFFFFF" }}>
					{label.toUpperCase()}
				</div>
			</div>
		</div>
	);
}
