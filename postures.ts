/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PostureDef } from './types';

export const POSTURES: PostureDef[] = [
  {
    id: 'warrior-ii',
    name: 'Warrior II (Virabhadrasana II)',
    category: 'Yoga',
    difficulty: 'Beginner',
    instructions: [
      'Take a wide stance (about 3-4 feet apart).',
      'Turn your front foot out 90 degrees and back foot slightly in.',
      'Bend your front knee to align directly over your ankle (aim for 90°).',
      'Extend your arms out horizontally, parallel to the ground.',
      'Look forward over your front fingertips, keeping your gaze relaxed.'
    ],
    idealAngles: [
      {
        joint: 'Front Knee Bend',
        landmarks: [23, 25, 27], // Pointing front (using Left side as front)
        min: 80,
        max: 105,
        label: 'Front Knee (Left)'
      },
      {
        joint: 'Back Knee Extension',
        landmarks: [24, 26, 28], // Right Knee straight
        min: 165,
        max: 180,
        label: 'Back Knee (Right)'
      },
      {
        joint: 'Front Arm Elevation',
        landmarks: [15, 11, 23], // Wrist-Shoulder-Hip (Left)
        min: 80,
        max: 105,
        label: 'Front Arm (Left)'
      },
      {
        joint: 'Back Arm Elevation',
        landmarks: [16, 12, 24], // Right arm horizontal
        min: 80,
        max: 105,
        label: 'Back Arm (Right)'
      }
    ],
    searchQuery: 'Virabhadrasana Warrior II yoga posture alignment tutorial Baba Ramdev scientific pranayam chest expansion guidelines',
    proModelName: 'Baba Ramdev'
  },
  {
    id: 'tree-pose',
    name: 'Tree Pose (Vrikshasana)',
    category: 'Yoga',
    difficulty: 'Beginner',
    instructions: [
      'Stand tall on your support foot (e.g. Left foot).',
      'Bend your other knee (Right knee) and place the foot against your inner thigh or calf (never directly on the knee joint).',
      'Join your palms together at your chest, or stretch your arms straight overhead.',
      'Keep your pelvis symmetrical and find a stationary focal point for balance.'
    ],
    idealAngles: [
      {
        joint: 'Support Knee Extension',
        landmarks: [23, 25, 27], // Supporting leg straight
        min: 168,
        max: 180,
        label: 'Support Leg (Left)'
      },
      {
        joint: 'Bent Knee Angle',
        landmarks: [24, 26, 28], // Raised knee bent deeply outward
        min: 35,
        max: 95,
        label: 'Bent Knee Openness'
      },
      {
        joint: 'Arm Overhead Extension',
        landmarks: [13, 11, 23], // Elbow-Shoulder-Hip for vertical arm
        min: 155,
        max: 180,
        label: 'Shoulder Extension (Left)'
      }
    ],
    searchQuery: 'Vrikshasana Tree Pose alignment biometrics scientific biomechanics yoga by Baba Ramdev patanjali',
    proModelName: 'Baba Ramdev'
  },
  {
    id: 'cricket-bowling',
    name: 'Cricket Fast Bowling (Delivery Stride)',
    category: 'Cricket',
    difficulty: 'Advanced',
    instructions: [
      'Plant your front foot strongly into the brace (delivery stance).',
      'Keep your front knee upright and straight to leverage height and transfer force (prevent knee collapsing).',
      'Rotate your hips and pull your non-bowling front arm down aggressively.',
      'Maintain a strong vertical spine as the bowling arm sweeps over the top.'
    ],
    idealAngles: [
      {
        joint: 'Plant Knee Brace',
        landmarks: [23, 25, 27], // Front leg (Left) brace - straight knee is essential!
        min: 155,
        max: 180,
        label: 'Front Brace Knee'
      },
      {
        joint: 'Bowling Arm Extension',
        landmarks: [12, 14, 16], // Right bowling Arm overhead
        min: 165,
        max: 180,
        label: 'Bowling Arm (Right)'
      },
      {
        joint: 'Front Guide Arm Pull',
        landmarks: [11, 13, 15], // Left hand pulling down
        min: 40,
        max: 110,
        label: 'Lead Elbow Flexion'
      },
      {
        joint: 'Spine-Torso Release Line',
        landmarks: [11, 23, 25], // Shoulder-Hip-Knee spinal tilt
        min: 110,
        max: 145,
        label: 'Release Hip Angle'
      }
    ],
    searchQuery: 'Brett Lee fast bowling mechanical style delivery stride front knee brace biomechanics coaching guidelines',
    proModelName: 'Brett Lee'
  },
  {
    id: 'cricket-cover-drive',
    name: 'Cricket Batting (Cover Drive Stance)',
    category: 'Cricket',
    difficulty: 'Intermediate',
    instructions: [
      'Stride out towards the pitch of the ball with your front foot.',
      'Bend your front knee deeply, letting your head lean over the knee line.',
      'Slightly flex your back leg to keep your balance centered.',
      'Swing your bat downwards to strike, keeping your back elbow raised high for control.'
    ],
    idealAngles: [
      {
        joint: 'Front Stride Knee Flex',
        landmarks: [23, 25, 27], // Left knee bent to reach pitch of ball
        min: 90,
        max: 125,
        label: 'Front Knee Bend'
      },
      {
        joint: 'Back Knee Stability',
        landmarks: [24, 26, 28], // Right knee slightly bent for balance
        min: 120,
        max: 155,
        label: 'Back Knee Balance'
      },
      {
        joint: 'Guide Elbow Elevation',
        landmarks: [11, 13, 15], // Left front elbow pointing high or flexed for high control
        min: 75,
        max: 115,
        label: 'Front Elbow Stance'
      }
    ],
    searchQuery: 'Vaibhav Suryavanshi classical cricket batting stance cover drive head balance over ball footwork',
    proModelName: 'Vaibhav Suryavanshi'
  },
  {
    id: 'basketball-shot',
    name: 'Basketball Shooting (Free Throw Release)',
    category: 'Athletics',
    difficulty: 'Intermediate',
    instructions: [
      'Align your feet shoulder-width apart, pointing towards the hoop.',
      'Bend your knees for power absorption.',
      'Set the basketball at your forehead, creating an elbow bend of about 90°.',
      'Extend knees and snap your wrist, straightening your elbow entirely on follow-through.'
    ],
    idealAngles: [
      {
        joint: 'Shooting Elbow Release',
        landmarks: [12, 14, 16], // Right elbow flexed (setpoint) or straight (release)
        min: 150,
        max: 180,
        label: 'Release Elbow Extension'
      },
      {
        joint: 'Slight Shoulder Lift',
        landmarks: [14, 12, 24], // Elbow-Shoulder-Hip
        min: 110,
        max: 145,
        label: 'Shoulder Set Height'
      },
      {
        joint: 'Power Knee Bend',
        landmarks: [24, 26, 28], // Right Knee bent during takeoff
        min: 130,
        max: 165,
        label: 'Knee Power Arch'
      }
    ],
    searchQuery: 'Optimal basketball shot angle mechanics Curry study wrist snap',
    proModelName: 'Stephen Curry'
  },
  {
    id: 'golf-swing',
    name: 'Golf Swing (Follow-Through)',
    category: 'Golf',
    difficulty: 'Advanced',
    instructions: [
      'Rotate your hips and torso completely toward the target direction.',
      'Transfer 90% of your weight to your lead foot.',
      'Keep your lead arm straight as your body unfurls.',
      'Allow your head to rotate naturally to protect your neck and spine.'
    ],
    idealAngles: [
      {
        joint: 'Lead Elbow Extension',
        landmarks: [11, 13, 15], // Left lead arm locked straight
        min: 168,
        max: 180,
        label: 'Lead Arm Straightness'
      },
      {
        joint: 'Lead Hip Rotation',
        landmarks: [12, 24, 26], // Hips fully open to target
        min: 155,
        max: 180,
        label: 'Hip Release'
      },
      {
        joint: 'Follow Through Torso',
        landmarks: [11, 23, 25], // Spine maintaining inclination
        min: 135,
        max: 165,
        label: 'Spine Post-Turn Angle'
      }
    ],
    searchQuery: 'Golf Swing biomechanics rotation spine angle and wrist release',
    proModelName: 'Tiger Woods'
  }
];
