const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const HISTORY_FILE = './conversation.json';

// 🧠 Carica la storia se esiste
let conversationHistory = [];
if (fs.existsSync(HISTORY_FILE)) {
  try {
    const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
    conversationHistory = JSON.parse(data);
  } catch (err) {
    console.error('Errore nel caricamento della storia:', err.message);
  }
}

// 💾 Salva la storia su file
function saveConversationHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(conversationHistory, null, 2), 'utf-8');
  } catch (err) {
    console.error('Errore nel salvataggio della storia:', err.message);
  }
}

function extractCodeBlocks(text) {
  const regex = /```(?:\w*\n)?([\s\S]*?)```/g;
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  return matches.length > 0 ? matches.join('\n\n') : text;
}

function detectFileExtension(code) {
  const patterns = {
    '.py': [/^\s*import\s/, /^\s*def\s/, /^\s*class\s/, /print\(/, /#.*?/],
    '.js': [/function\s/, /console\.log/, /let\s/, /const\s/, /var\s/],
    '.html': [/<!DOCTYPE html>/, /<html>/, /<head>/, /<body>/, /<\/html>/],
    '.css': [/\.\w+\s*\{/, /#\w+\s*\{/, /[a-z-]+\s*:\s*[^;]+;/],
    '.java': [/public\s+class\s/, /System\.out\.println/],
    '.c': [/#include\s*<stdio.h>/, /int\s+main\s*\(/, /printf\(/],
    '.cpp': [/#include\s*<iostream>/, /std::cout/, /int\s+main\s*\(/],
    '.sh': [/^#!\/bin\/bash/, /echo\s/, /^\s*if\s+\[.*\]/],
    '.json': [/^\s*\{.*\}\s*$/, /"\w+"\s*:\s*/],
    '.xml': [/^<\?xml/, /<\w+>/, /<\/\w+>/],
    '.ts': [/import\s.*from\s.*;/, /let\s/, /const\s/, /function\s/],
    '.go': [/package\s+main/, /func\s+main\(\)/, /import\s+"fmt"/],
    '.rb': [/def\s/, /class\s/, /puts\s/],
    '.php': [/<?php/, /echo\s/, /\$\w+/],
  };

  for (const [ext, regexList] of Object.entries(patterns)) {
    if (regexList.some(regex => regex.test(code))) {
      return ext;
    }
  }

  return '.txt';
}

app.get('/api/models', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:11434/api/tags');
    res.json(response.data);
  } catch (error) {
    console.error('Errore nel recupero dei modelli:', error.message);
    res.status(500).json({ error: 'Errore nel recupero dei modelli' });
  }
});

function parseAndCreateFiles(responseText, baseFolder = './generated/project') {
  const pattern = /\/\/\s*File:\s*(.*?)\n([\s\S]*?)(?=(\/\/\s*File:|$))/g;
  const matches = [...responseText.matchAll(pattern)];
  const createdFiles = [];

  for (const match of matches) {
    const relativePath = match[1].trim();
    const content = match[2].trim();
    const fullPath = path.join(baseFolder, relativePath);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    createdFiles.push(fullPath);
  }

  return createdFiles;
}

app.post('/api/generate', async (req, res) => {
  const { model, prompt, folder, onlyCode } = req.body;
  const folderPath = folder || './generated';

  // 🧠 Costruzione del prompt con contesto
  const fullPrompt = conversationHistory.map(entry => `Utente: ${entry.prompt}\nModello: ${entry.response}`).join('\n\n') + `\n\nUtente: ${prompt}`;

  try {
    const response = await axios({
      method: 'post',
      url: 'http://localhost:11434/api/generate',
      data: { model, prompt: fullPrompt },
      responseType: 'stream'
    });

    let output = '';

    response.data.on('data', chunk => {
      try {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            output += parsed.response;
          }
        }
      } catch (err) {
        console.error('Errore nel parsing del chunk:', err.message);
      }
    });

    response.data.on('end', () => {
      const finalOutput = onlyCode ? extractCodeBlocks(output) : output;

      // 🧠 Aggiorna la storia della conversazione
      conversationHistory.push({ prompt, response: finalOutput });
      saveConversationHistory();

      if (finalOutput.includes('// File:')) {
        const createdFiles = parseAndCreateFiles(finalOutput, folderPath);
        res.json({ response: finalOutput, files: createdFiles });
      } else {
        const extension = detectFileExtension(finalOutput);
        const fileName = `output_${Date.now()}${extension}`;
        const fullPath = path.join(folderPath, fileName);

        fs.mkdirSync(folderPath, { recursive: true });
        fs.writeFileSync(fullPath, finalOutput, 'utf-8');
        res.json({ response: finalOutput, filePath: fullPath });
      }
    });

  } catch (error) {
    console.error('Errore nella generazione:', error.message);
    res.status(500).json({ error: 'Errore nella generazione' });
  }
});

// 🔄 Endpoint per resettare la storia
app.post('/api/reset', (req, res) => {
  conversationHistory = [];
  saveConversationHistory();
  res.json({ message: 'Storia della conversazione resettata e file pulito.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend avviato su http://localhost:${PORT}`);
});
