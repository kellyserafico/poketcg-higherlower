import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		proxy: {
			"/api": {
				target: "https://api.pokemontcg.io",
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ""),
				timeout: 60000, // 60 second timeout
				configure: (proxy, _options) => {
					proxy.on("proxyReq", (proxyReq, req, _res) => {
						// Forward the X-Api-Key header from environment variable
						const apiKey = process.env.VITE_POKEMON_TCG_API_KEY;
						if (apiKey) {
							proxyReq.setHeader("X-Api-Key", apiKey);
						}
						// Also check if the header was sent from the client
						const clientApiKey = req.headers["x-api-key"];
						if (clientApiKey) {
							proxyReq.setHeader("X-Api-Key", clientApiKey);
						}
					});
				},
			},
		},
	},
});
