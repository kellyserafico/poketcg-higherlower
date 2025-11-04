import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { useEffect } from 'react';

function App() {
  const getRandomCard = async() => {
    const randomPage = Math.floor(Math.random() * 100) + 1;
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?page=${randomPage}&pageSize=1&q=supertype:pokemon`);
    const data = await res.json();
    console.log(data.data[0]);
    return data.data[0];
  }

  return (
  <>
    <h1>Pokémon Higher or Lower</h1>
    <button onClick={getRandomCard}>Get Random Card</button>
  </>
  )
}

export default App
