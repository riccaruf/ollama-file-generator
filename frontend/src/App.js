import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [projectType, setProjectType] = useState('react-app');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [folderPath, setFolderPath] = useState('./generated');
  const [onlyCode, setOnlyCode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const templates = {
    'react-app': 'Genera una app React completa, includendo tutti i file necessari. Specifica il nome e il contenuto di ogni file nel formato: // File: percorso/nomefile.ext seguito dal contenuto.',
    'python-script': 'Genera uno script Python completo, includendo eventuali file esterni necessari. Specifica il nome e il contenuto di ogni file nel formato: // File: percorso/nomefile.ext seguito dal contenuto.',
    'web-scraper': 'Genera un progetto completo per uno scraper web in Python, includendo file di configurazione, script e eventuali risorse. Usa il formato: // File: percorso/nomefile.ext seguito dal contenuto.'
  };

  useEffect(() => {
    axios.get('http://localhost:3001/api/models')
      .then(res => {
        setModels(res.data.models || []);
      })
      .catch(err => console.error('Errore nel caricamento dei modelli:', err));
  }, []);

  useEffect(() => {
    setPrompt(templates[projectType]);
  }, [projectType]);

  const handleGenerate = () => {
    setLoading(true);
    axios.post('http://localhost:3001/api/generate', {
      model: selectedModel,
      prompt,
      folder: folderPath,
      onlyCode
    })
    .then(res => {
      setOutput(res.data.response || 'Nessuna risposta');
    })
    .catch(err => console.error('Errore nella generazione:', err))
    .finally(() => setLoading(false));
  };

  const handleReset = () => {
    setResetting(true);
    axios.post('http://localhost:3001/api/reset')
      .then(() => {
        setOutput('');
        alert('✅ Conversazione resettata con successo.');
      })
      .catch(err => {
        console.error('Errore nel reset della conversazione:', err);
        alert('❌ Errore nel reset.');
      })
      .finally(() => setResetting(false));
  };

  return (
    <div className="container">
      <h1>🧠 Generatore di codice con Ollama</h1>

      <label>Modello:</label>
      <select onChange={e => setSelectedModel(e.target.value)} value={selectedModel}>
        <option value="">Seleziona un modello</option>
        {models.map((model, idx) => (
          <option key={idx} value={model.name}>{model.name}</option>
        ))}
      </select>

      <label>Tipo di progetto:</label>
      <select onChange={e => setProjectType(e.target.value)} value={projectType}>
        <option value="react-app">App React</option>
        <option value="python-script">Script Python</option>
        <option value="web-scraper">Web Scraper</option>
      </select>

      <label>Prompt:</label>
      <textarea
        rows="6"
        placeholder="Scrivi qui il tuo prompt..."
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
      />

      <label>Cartella di destinazione:</label>
      <input
        type="text"
        value={folderPath}
        onChange={e => setFolderPath(e.target.value)}
        placeholder="./generated"
      />

      <label>
        <input
          type="checkbox"
          checked={onlyCode}
          onChange={e => setOnlyCode(e.target.checked)}
        />
        Mostra solo codice
      </label>

      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        <button onClick={handleGenerate} disabled={loading}>
          {loading ? '⏳ Generazione in corso...' : '🚀 Genera'}
        </button>

        <button onClick={handleReset} disabled={resetting}>
          {resetting ? '🧹 Reset in corso...' : '🧹 Reset conversazione'}
        </button>
      </div>

      <h2>Risultato:</h2>
      <pre className="output">{output}</pre>
    </div>
  );
}

export default App;
