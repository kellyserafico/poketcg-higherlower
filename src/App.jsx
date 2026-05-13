import { useState } from "react";
import HomePage from "./HomePage";
import GamePage from "./GamePage";
import "./App.css";

function App() {
	const [page, setPage] = useState("home");
	const [selectedSet, setSelectedSet] = useState(null);

	const handleSelectSet = (set) => {
		setSelectedSet(set);
		setPage("game");
	};

	const handleBack = () => {
		setPage("home");
		setSelectedSet(null);
	};

	if (page === "game") return <GamePage selectedSet={selectedSet} onBack={handleBack} />;
	return <HomePage onSelectSet={handleSelectSet} />;
}

export default App;
