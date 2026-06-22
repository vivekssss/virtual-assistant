/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Point {
  x: number;
  y: number;
}

export type PostureCategory = 'Yoga' | 'Cricket' | 'Athletics' | 'Golf';

export interface IdealAngleConfig {
  joint: string;                // e.g., "Left Elbow", "Right Knee", "Spine Angle"
  landmarks: [number, number, number]; // index sequence for angle calculation, e.g. [11, 13, 15] for left wrist-elbow-shoulder
  min: number;                  // Minimum acceptable angle in degrees
  max: number;                  // Maximum acceptable angle in degrees
  label: string;                // Front-facing label
}

export interface PostureDef {
  id: string;
  name: string;
  category: PostureCategory;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  instructions: string[];
  idealAngles: IdealAngleConfig[];
  searchQuery: string; // Grounding query to find professional bio-mechanics data online
  proModelName: string; // e.g. "Sachin Tendulkar", "Malcolm Marshall", "BKS Iyengar"
}

export interface JointAngleState {
  joint: string;
  angle: number;
  status: 'optimal' | 'out-of-bound';
  label: string;
}

export interface PoseFeedback {
  overallScore: number;
  status: 'excellent' | 'good' | 'correction-needed' | 'poor';
  primaryAssessment: string;
  jointAnalyses: {
    jointName: string;
    issueDetected: boolean;
    correctionTip: string;
  }[];
  proInsights: string; // Grounding search insights or comparison to legendary athletes
  actionItems: string[];
}

export interface DebugInfo {
  latency: number;
  screenshotBase64?: string;
  promptContext: string;
  rawResponse: string;
  parsedResponse?: any;
  error?: string;
  timestamp: string;
}

export interface AiResponse {
  feedback: PoseFeedback;
  debug: DebugInfo;
}

// MediaPipe Type Definitions (Augmenting window)
declare global {
  interface Window {
    Pose: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    POSE_CONNECTIONS: any;
    POSE_LANDMARKS_LEFT: any;
    POSE_LANDMARKS_RIGHT: any;
    POSE_LANDMARKS_neutral: any;
  }
}
