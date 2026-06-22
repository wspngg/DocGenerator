export default async function handler(req, res) {
  // On n'accepte que les requêtes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { prompt, docType } = req.body;

  const SYSTEM_PROMPT = `Tu es un assistant expert en rédaction de documents professionnels pour Colas Digital Solutions.
  Réponds UNIQUEMENT avec un JSON valide (aucun texte avant/après, aucun markdown) :
  {
    "title": "Titre du document",
    "sections": [
      { "level": 1, "title": "Titre section", "content": "HTML simple : <p>, <ul><li>, <strong>, <em>, <table>" }
    ]
  }`;

  try {
    // Appel sécurisé vers GitHub Models
    const ghResponse = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Vercel va injecter ta clé secrète ici !
        'Authorization': `Bearer ${process.env.GITHUB_AI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Type: ${docType}\nDemande: ${prompt}` }
        ],
        max_tokens: 2500,
        temperature: 0.4
      })
    });

    if (!ghResponse.ok) throw new Error(`Erreur API: ${ghResponse.statusText}`);

    const data = await ghResponse.json();
    const rawContent = data.choices[0].message.content.trim();
    const parsedData = JSON.parse(rawContent.replace(/```json|```/g, '').trim());

    // Renvoie la réponse à ton index.html
    res.status(200).json(parsedData);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
