// Configuration — DeepSeek uniquement (consigne de l'événement). Tout vient de .env.local.
export const config = {
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
  baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  // M1 : pose les questions fermées
  questionModel: process.env.DEEPSEEK_QUESTION_MODEL ?? "deepseek-flash",
  // M2 : lit et choisit (peut être un modèle faible : la sécurité vient du harnais)
  readerModel: process.env.DEEPSEEK_READER_MODEL ?? "deepseek-flash",
  // M3 : rédige les textes des cartes et le rapport, uniquement depuis le tableau validé
  writerModel: process.env.DEEPSEEK_WRITER_MODEL ?? "deepseek-v4-pro",
  // Réflexion (thinking) : désactivée par défaut pour la vitesse ; activable pour le rédacteur
  writerThinking: process.env.DEEPSEEK_WRITER_THINKING === "on",
  readingsPerQuestion: 2,
  maxWriterAttempts: 2,
  llmTimeoutMs: 120_000,
  // Mot de passe optionnel pour une démo exposée via ngrok
  demoPassword: process.env.DEMO_PASSWORD ?? "",
};
