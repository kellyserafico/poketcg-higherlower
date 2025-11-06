import express from "express";
import cors from "cors";
import pokemon from "pokemontcgsdk";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const API_KEY = process.env.POKEMON_TCG_API_KEY || "";
if (API_KEY) {
	pokemon.configure({ apiKey: API_KEY });
} else {
	console.warn("Warning: POKEMON_TCG_API_KEY not set. Some API calls may be rate-limited.");
}

// ✅ Get a random card
app.get("/api/random-card", async (req, res) => {
	try {
		const offset = Math.floor(Math.random() * 25000);
		const page = Math.floor(offset / 250);

		const cards = await pokemon.card.where({
			q: "supertype:pokemon",
			pageSize: 1,
			page,
		});

		// ✅ Use cards.data instead of cards
		if (cards.data && cards.data.length > 0) {
			res.json(cards.data[0]);
		} else {
			res.status(404).json({ error: "No card found" });
		}
	} catch (error) {
		console.error("Error fetching random card:", error);
		res.status(500).json({ error: "Failed to fetch card", details: error.message });
	}
});

// ✅ Get multiple random cards
app.get("/api/random-cards", async (req, res) => {
	try {
		const count = parseInt(req.query.count) || 2;
		const promises = [];

		for (let i = 0; i < count; i++) {
			const offset = Math.floor(Math.random() * 25000);
			const page = Math.floor(offset / 250);
			promises.push(
				pokemon.card.where({
					q: "supertype:pokemon",
					pageSize: 1,
					page,
				})
			);
		}

		const results = await Promise.all(promises);

		// ✅ Extract .data arrays and flatten
		const cards = results.map((result) => result.data?.[0]).filter(Boolean);

		if (cards.length > 0) {
			res.json(cards);
		} else {
			res.status(404).json({ error: "Failed to fetch cards" });
		}
	} catch (error) {
		console.error("Error fetching random cards:", error);
		res.status(500).json({ error: "Failed to fetch cards", details: error.message });
	}
});

app.listen(PORT, () => {
	console.log(`✅ Server running on http://localhost:${PORT}`);
});
