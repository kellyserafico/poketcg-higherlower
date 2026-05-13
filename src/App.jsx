import { useState } from "react";
import HomePage from "./HomePage";
import GamePage from "./GamePage";
import MultiplayerLobbyPage from "./MultiplayerLobbyPage";
import MultiplayerGamePage from "./MultiplayerGamePage";
import "./App.css";

function App() {
	const [page, setPage] = useState("home");
	const [selectedSet, setSelectedSet] = useState(null);
	const [multiplayerSession, setMultiplayerSession] = useState(null);

	const handleSelectSet = (set) => {
		setSelectedSet(set);
		setPage("game");
	};

	const handleMultiplayerStart = (session) => {
		setMultiplayerSession(session);
		setPage("multiplayer-game");
	};

	const handleBack = () => {
		if (multiplayerSession?.peer) {
			multiplayerSession.peer.destroy();
		}
		setMultiplayerSession(null);
		setPage("home");
		setSelectedSet(null);
	};

	if (page === "game") return <GamePage selectedSet={selectedSet} onBack={handleBack} />;
	if (page === "multiplayer-lobby") return <MultiplayerLobbyPage onGameStart={handleMultiplayerStart} onBack={handleBack} />;
	if (page === "multiplayer-game" && multiplayerSession) {
		return (
			<MultiplayerGamePage
				peer={multiplayerSession.peer}
				conn={multiplayerSession.conn}
				isHost={multiplayerSession.isHost}
				myName={multiplayerSession.myName}
				opponentName={multiplayerSession.opponentName}
				roomCode={multiplayerSession.roomCode}
				onBack={handleBack}
			/>
		);
	}

	return <HomePage onSelectSet={handleSelectSet} onMultiplayer={() => setPage("multiplayer-lobby")} />;
}

export default App;
