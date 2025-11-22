export default function Header() {
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
			<h1 style={{ fontSize: "24px", fontWeight: "bold" }}>PokéTCG Higher Lower</h1>
			<div style={{ display: "flex", flexDirection: "row", gap: "16px" }}>
				<div>Score</div>
				<div>High Score</div>
			</div>
		</div>
	);
}
