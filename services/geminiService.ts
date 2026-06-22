/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { PostureDef, PoseFeedback, JointAngleState, AiResponse, DebugInfo } from "../types";

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;

if (process.env.API_KEY || process.env.GEMINI_API_KEY) {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  ai = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  console.warn("Gemini API key is not configured in process.env.GEMINI_API_KEY.");
}

const MODEL_NAME = "gemini-3.5-flash";

export const evaluatePosture = async (
  imageBase64: string,
  posture: PostureDef,
  calculatedAngles: JointAngleState[]
): Promise<AiResponse> => {
  const startTime = performance.now();

  const debug: DebugInfo = {
    latency: 0,
    screenshotBase64: imageBase64,
    promptContext: "",
    rawResponse: "",
    timestamp: new Date().toLocaleTimeString()
  };

  // 1. Local Heuristic Assessment (Fallback/Underlay)
  // Computes a rating based on joint angle deviations
  const generateLocalAssessment = (): PoseFeedback => {
    let outOfBoundsCount = 0;
    const jointAnalyses = calculatedAngles.map(a => {
      const targetAngleDef = posture.idealAngles.find(ideal => ideal.label === a.label);
      const isOk = a.status === 'optimal';
      if (!isOk) outOfBoundsCount++;

      let tips = `Keep maintaining alignment within ideal bounds.`;
      if (!isOk && targetAngleDef) {
        if (a.angle < targetAngleDef.min) {
          tips = `Increase angle of ${a.label}. Extend or open up slightly more (Current: ${a.angle}°, Target: ${targetAngleDef.min}°-${targetAngleDef.max}°).`;
        } else {
          tips = `Decrease angle of ${a.label}. Flex or narrow down joint slightly (Current: ${a.angle}°, Target: ${targetAngleDef.min}°-${targetAngleDef.max}°).`;
        }
      }

      return {
        jointName: a.label,
        issueDetected: !isOk,
        correctionTip: tips
      };
    });

    const maxJoints = calculatedAngles.length || 1;
    const deviationScorePct = Math.max(0, 100 - Math.round((outOfBoundsCount / maxJoints) * 45));

    let localStatus: 'excellent' | 'good' | 'correction-needed' | 'poor' = 'excellent';
    if (deviationScorePct >= 90) localStatus = 'excellent';
    else if (deviationScorePct >= 75) localStatus = 'good';
    else if (deviationScorePct >= 50) localStatus = 'correction-needed';
    else localStatus = 'poor';

    const localAssessmentMsg = outOfBoundsCount === 0
      ? `Brilliant posture! All tracked joints fall perfectly inside the biomechanical standard for ${posture.name}.`
      : `Minor postural misalignments detected in ${outOfBoundsCount} checked body segment(s). Try adjusting your stance.`;

    return {
      overallScore: deviationScorePct,
      status: localStatus,
      primaryAssessment: localAssessmentMsg,
      jointAnalyses,
      proInsights: `Local Alignment Reference: Calculated using structural angles for ${posture.name} modeled after ${posture.proModelName}. Open up the camera view fully to auto-validate limb vectors. In production, Gemini searches biomechanics online to cross-verify.`,
      actionItems: calculatedAngles
        .filter(a => a.status === 'out-of-bound')
        .map(a => `Adjust ${a.label} to bring it into the standard range.`)
    };
  };

  const localFeedback = generateLocalAssessment();

  // If no Gemini client is available, slip in our lovely local mathematical coach
  if (!ai) {
    debug.error = "API Key Missing. Switched to local trigonometric biometric compiler.";
    debug.promptContext = "No remote dispatch. Heuristics generated.";
    debug.rawResponse = JSON.stringify(localFeedback, null, 2);
    
    return {
      feedback: localFeedback,
      debug: {
        ...debug,
        latency: Math.round(performance.now() - startTime),
        parsedResponse: localFeedback
      }
    };
  }

  // 2. Build the Gemini Prompt
  const jointDataText = calculatedAngles.map(a => {
    const config = posture.idealAngles.find(ideal => ideal.label === a.label);
    const rangeText = config ? `${config.min}° to ${config.max}°` : "Open";
    return `- Joint: ${a.label} | Current Angle: ${a.angle}° | Ideal Bounds: ${rangeText} | Status: ${a.status.toUpperCase()}`;
  }).join("\n");

  const instructionsText = posture.instructions.map((i, index) => `${index + 1}. ${i}`).join("\n");

  const prompt = `
    You are an elite sports biomechanics specialist, professional posture correction analyst, and master yogi.
    Your task is to analyze the user's sports/yoga pose using the provided camera snapshot and calculated joint angles.
    
    ### TARGET EXERCISE / MOVEMENT
    - Name: ${posture.name} (${posture.category})
    - Benchmark Standard/Legend: ${posture.proModelName}
    - Difficulty Rating: ${posture.difficulty}
    
    ### CORE POSTURAL INSTRUCTIONS
    ${instructionsText}

    ### REAL-TIME TRIGONOMETRIC BIOMETRIC FEEDBACK (MediaPipe Skeleton):
    ${jointDataText}

    ### YOUR MANDATE
    1. Search the web to find professional biomechanics reports or expert alignment tutorials regarding "${posture.searchQuery}".
    2. Review the user's visual frame (from the snapshot) and joint angles. Highlight precisely what looks correct (e.g. back knee brace, straight posture) and what needs immediate modification.
    3. Compare their limb angles and posture with standard elite execution (like how ${posture.proModelName} performs it, e.g. Glenn McGrath's locked front knee brace or BKS Iyengar's level hips).
    4. Formulate specific correction cues ("Push your left knee forward", "Bring your back elbow higher").
    5. Return highly constructive, professional coaching items.
    
    ### RESPONSE SCHEMA (Strictly return RAW JSON only)
    Do not wrap inside markdown \`\`\`json blocks. Do not add comments or trailing commas.
    JSON fields required:
    {
      "overallScore": integer (0 to 100),
      "status": "excellent" | "good" | "correction-needed" | "poor",
      "primaryAssessment": "One sentence summary matching the joint results.",
      "jointAnalyses": [
        {
          "jointName": "Name of joint, e.g. Front Knee",
          "issueDetected": true|false,
          "correctionTip": "Specific, actionable muscle-memory correction tip."
        }
      ],
      "proInsights": "Biomechanical insights derived from online search about ${posture.proModelName}'s execution and research standard guidelines.",
      "actionItems": [
        "Action cue 1",
        "Action cue 2"
      ]
    }
  `;

  debug.promptContext = `Postures Query: ${posture.id}\nJoint Angles:\n${jointDataText}`;

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64
          }
        }
      ],
      config: {
        temperature: 0.35,
        responseMimeType: "application/json",
        maxOutputTokens: 2048,
        tools: [
          { googleSearch: {} } // Enable search grounding to query sports data online
        ]
      }
    });

    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    
    let text = response.text || "";
    debug.rawResponse = text;

    // Isolate pure JSON
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }

    try {
      const parsed = JSON.parse(text);
      debug.parsedResponse = parsed;

      // Validate schema
      if (typeof parsed.overallScore === 'number' && parsed.status && parsed.actionItems) {
        return {
          feedback: {
            overallScore: parsed.overallScore,
            status: parsed.status,
            primaryAssessment: parsed.primaryAssessment || "Coaching analysis compiled.",
            jointAnalyses: parsed.jointAnalyses || localFeedback.jointAnalyses,
            proInsights: parsed.proInsights || `Referencing correct alignment of ${posture.proModelName}.`,
            actionItems: parsed.actionItems
          },
          debug
        };
      }
      
      throw new Error("Missing required JSON fields in AI response.");
    } catch (parseError: any) {
      console.warn("Failed to parse Gemini posture analysis JSON:", text, parseError);
      return {
        feedback: {
          ...localFeedback,
          primaryAssessment: `[Local Biomechanics Assessment] ${localFeedback.primaryAssessment}`
        },
        debug: {
          ...debug,
          error: `JSON Parse / Validation Error: ${parseError.message}. Fell back to local mathematical scoring.`
        }
      };
    }

  } catch (error: any) {
    console.error("Gemini Posture AI Service Error:", error);
    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    
    return {
      feedback: {
        ...localFeedback,
        primaryAssessment: `[Offline Local Coach] ${localFeedback.primaryAssessment}`
      },
      debug: {
        ...debug,
        error: `API Call Failure: ${error.message || "Unknown Network Error"}`
      }
    };
  }
};
