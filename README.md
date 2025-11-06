# Pokemon TCG Higher or Lower Game

A React + Vite game where you guess which Pokemon card is worth more or less.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up your Pokemon TCG API key:**
   - Get your free API key from [pokemontcg.io](https://pokemontcg.io/)
   - Create a `.env` file in the root directory:
     ```
     POKEMON_TCG_API_KEY=your_api_key_here
     PORT=3001
     VITE_API_URL=http://localhost:3001
     ```

3. **Run the application:**
   - Start the backend server (in one terminal):
     ```bash
     npm run server
     ```
   - Start the frontend dev server (in another terminal):
     ```bash
     npm run dev
     ```

## How it works

The app uses the official [pokemontcgsdk](https://www.npmjs.com/package/pokemontcgsdk) npm package, which runs on the server to bypass CORS restrictions. The Express backend server handles all Pokemon TCG API calls, and the React frontend communicates with the backend.

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Express.js
- **SDK:** pokemontcgsdk (official Pokemon TCG SDK)
- **Styling:** Tailwind CSS
