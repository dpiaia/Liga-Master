
import { GoogleGenAI, Type } from "@google/genai";
import { TournamentFormat, TournamentRules, Team } from "../types";

export async function generateTeamShield(team: Team): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `A professional sports logo crest for a soccer team named '${team.name}'. Minimalist vector style, clean lines, professional branding. Primary color: ${team.colors.primary}, Secondary color: ${team.colors.secondary}. The design should be a clean shield or badge, high quality, 1:1 aspect ratio, centered design on a solid dark background. No text inside unless it's just a letter.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    if (!response.candidates?.[0]?.content?.parts) return null;

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error: any) {
    // Detectar erro de cota (429) ou outros erros de limite
    if (error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('quota')) {
       console.error("Limite de cota da API Gemini atingido para geração de imagens.");
       throw new Error("QUOTA_EXHAUSTED");
    }
    console.error("Erro genérico ao gerar escudo:", error);
    return null;
  }
}

export async function identifyAmbiguities(wizardData: any, naturalInput: string): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Você é um consultor técnico da FIFA. Analise os dados deste torneio e o pedido manual do usuário para identificar de 2 a 3 pontos técnicos que ainda estão vagos ou contraditórios.
    
    DADOS ESTRUTURADOS:
    Nome: ${wizardData.name}
    Equipes: ${wizardData.teamsCount}
    Formato Base: ${wizardData.format}

    PEDIDO DO USUÁRIO:
    "${naturalInput}"

    INSTRUÇÃO: Identifique o que falta para que o motor lógico funcione sem assumir padrões. 
    Exemplos de dúvidas:
    - Se o usuário pediu playoffs, mas não disse como resolve empate (pênaltis ou vantagem?).
    - Se o usuário pediu liga, mas não definiu critério de desempate (SG, Gols Pró ou Confronto Direto?).
    - Se o usuário pediu grupos, mas não disse quantos times avançam.

    Retorne APENAS um array de strings em JSON contendo as perguntas para o usuário.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  try {
    const text = response.text;
    if (!text) return ["Como os empates em eliminatórias devem ser resolvidos?", "Qual o principal critério de desempate na tabela?"];
    return JSON.parse(text.trim());
  } catch (e) {
    return ["Como os empates em eliminatórias devem ser resolvidos?", "Qual o principal critério de desempate na tabela?"];
  }
}

export async function parseTournamentRules(prompt: string): Promise<TournamentRules> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Você é um arquiteto de ligas de futebol. Transforme o pedido consolidado do usuário em um JSON de configuração estrito.
    
    Pedido Consolidado: "${prompt}"

    Diretrizes Críticas:
    1. 'startDate' deve ser YYYY-MM-DD.
    2. 'tieBreakerRules' deve ser um array ordenado: ["GOAL_DIFF", "GOALS_FOR", "HEAD_TO_HEAD"].
    3. 'pointsForWin' padrão é 3, 'pointsForDraw' é 1, 'pointsForLoss' é 0, a menos que especificado.
    4. Formatos permitidos: ROUND_ROBIN, KNOCKOUT, WORLD_CUP, CHAMPIONS, CUSTOM.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          format: { type: Type.STRING, enum: Object.values(TournamentFormat) },
          teamsCount: { type: Type.NUMBER },
          rounds: { type: Type.NUMBER },
          hasReturnMatch: { type: Type.BOOLEAN },
          pointsForWin: { type: Type.NUMBER },
          pointsForDraw: { type: Type.NUMBER },
          pointsForLoss: { type: Type.NUMBER },
          startDate: { type: Type.STRING },
          tieBreakerRules: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
          customFixtures: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                round: { type: Type.NUMBER },
                homeTeamName: { type: Type.STRING },
                awayTeamName: { type: Type.STRING }
              },
              required: ["round", "homeTeamName", "awayTeamName"]
            }
          }
        },
        required: ["name", "format", "teamsCount", "pointsForWin", "pointsForDraw", "pointsForLoss", "tieBreakerRules"]
      }
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("A IA retornou uma resposta vazia.");
  }
  return JSON.parse(text.trim());
}
