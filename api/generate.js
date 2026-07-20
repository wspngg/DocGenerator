export default async function handler(req, res) {
  // On n'accepte que les requêtes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { prompt, docType } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt manquant' });
  }
  if (!process.env.GITHUB_AI_KEY) {
    return res.status(500).json({ error: 'GITHUB_AI_KEY non configurée sur Vercel' });
  }

  const SYSTEM_PROMPT = `Tu es un assistant expert en rédaction de documents professionnels pour Colas Digital Solutions.

Réponds UNIQUEMENT avec un JSON valide (aucun texte avant/après, aucun markdown) :
{
  "title": "Titre du document",
  "sections": [
    { "level": 1, "title": "Titre section", "content": "HTML simple : <p>, <ul><li>, <strong>, <em>, <table>" }
  ]
}

Règles :
- Français professionnel et technique
- Minimum 4 sections substantielles avec contenu réaliste
- Tableaux quand pertinent
- Contenu HTML simple uniquement (<p> <ul> <li> <strong> <em> <table> <tr> <th> <td>)`;

  try {
    // Nouvel endpoint GitHub Models (l'ancien azure.com est mort depuis oct. 2025)
    const ghResponse = await fetch('https://models.github.ai/inference/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GITHUB_AI_KEY}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o', // préfixe "openai/" obligatoire sur le nouvel endpoint
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Type: ${docType || 'Document'}\nDemande: ${prompt}` }
        ],
        max_tokens: 2500,
        temperature: 0.4
      })
    });

    if (!ghResponse.ok) {
      // On remonte le vrai message d'erreur GitHub (401, 429, modèle inconnu…)
      const errText = await ghResponse.text().catch(() => ghResponse.statusText);
      throw new Error(`API ${ghResponse.status} : ${errText}`);
    }

    const data = await ghResponse.json();
    const rawContent = data.choices[0].message.content.trim();
    const parsedData = JSON.parse(rawContent.replace(/```json|```/g, '').trim());

    // Renvoie { title, sections } à index.html
    res.status(200).json(parsedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
