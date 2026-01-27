
import { GoogleGenAI, Type } from "@google/genai";
import { TournamentFormat, TournamentRules, Team } from "../types";

/**
 * Utilitário para limpar respostas da IA que podem vir envoltas em blocos markdown
 */
function cleanJsonString(input: string): string {
  return input.replace(/```json\n?|```/g, '').trim();
}

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
    model: 'gemini-3-flash-preview', // Usando Flash para maior estabilidade em prod
    contents: `Você é um consultor técnico da FIFA. Analise os dados deste torneio e o pedido manual do usuário para identificar de 2 a 3 pontos técnicos que ainda estão vagos ou contraditórios.
    
    DADOS ESTRUTURADOS:
    Nome: ${wizardData.name}
    Equipes: ${wizardData.teamsCount}
    Formato Base: ${wizardData.format}

    PEDIDO DO USUÁRIO:
    "${naturalInput}"

    Retorne APENAS um array de strings em JSON.`,
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
    if (!text) return ["Defina os critérios de desempate.", "Defina a data de início."];
    return JSON.parse(cleanJsonString(text));
  } catch (e) {
    console.error("Erro ao parsear ambigüidades:", e);
    return ["Defina os critérios de desempate.", "Defina a data de início."];
  }
}

export async function parseTournamentRules(prompt: string): Promise<TournamentRules> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', // Usando Flash para maior estabilidade em prod
    contents: `Você é um arquiteto de ligas de futebol. Transforme o pedido consolidado do usuário em um JSON de configuração estrito.
    
    Pedido Consolidado: "${prompt}"

    Diretrizes:
    1. 'startDate' deve ser YYYY-MM-DD.
    2. 'tieBreakerRules' deve ser: ["GOAL_DIFF", "GOALS_FOR", "HEAD_TO_HEAD"].
    3. Formatos: ROUND_ROBIN, KNOCKOUT, WORLD_CUP, CHAMPIONS, CUSTOM.`,
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
              }
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
  
  try {
    return JSON.parse(cleanJsonString(text));
  } catch (e) {
    console.error("Erro de parse JSON da IA:", text);
    throw new Error("Falha ao processar estrutura lógica do torneio.");
  }
}
