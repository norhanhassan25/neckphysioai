/**
 * Neck rehabilitation exercise video library.
 * The videos and category labels below are based on the resources supplied
 * for this project. Clinical prescription and camera scoring are handled in
 * later implementation stages; this file intentionally stores no invented
 * dosage, range-of-motion target, or diagnosis.
 */
export type NeckExerciseCategory =
  | 'Deep cervical flexor training'
  | 'Cervical isometric exercises'
  | 'Proprioceptive rehabilitation'
  | 'Tracking training';

export interface NeckExerciseResource {
  id: string;
  title: string;
  category: NeckExerciseCategory;
  description: string;
  videoUrl: string;
  progression?: string;
  usesLaserBiofeedback?: boolean;
  isOptional?: boolean;
}

export const NECK_EXERCISES: NeckExerciseResource[] = [
  {
    id: 'deep-flexor-1',
    title: 'Deep Cervical Flexor Training',
    category: 'Deep cervical flexor training',
    description: 'Foundational deep cervical flexor exercise video supplied for the rehabilitation library.',
    videoUrl: 'https://youtube.com/shorts/v9vK-ORuvKo',
    progression: 'Progression video 1',
  },
  {
    id: 'deep-flexor-2',
    title: 'Deep Cervical Flexor Training',
    category: 'Deep cervical flexor training',
    description: 'Follow-up progression resource for deep cervical flexor training.',
    videoUrl: 'https://youtube.com/shorts/w-W0kOcff4k',
    progression: 'Progression video 2',
  },
  {
    id: 'cervical-isometric',
    title: 'Cervical Isometric Exercises',
    category: 'Cervical isometric exercises',
    description: 'Video resource for cervical isometric exercise practice.',
    videoUrl: 'https://youtube.com/shorts/yIFJ-AcqZiY',
  },
  {
    id: 'laser-proprioception',
    title: 'Cervical Proprioceptive Rehabilitation',
    category: 'Proprioceptive rehabilitation',
    description: 'Proprioceptive rehabilitation resource using laser biofeedback (Optional supplementary exercise).',
    videoUrl: 'https://youtu.be/tbySm4GaEdU',
    usesLaserBiofeedback: true,
    isOptional: true,
  },
  {
    id: 'tracking-1',
    title: 'Cervical Tracking Training',
    category: 'Tracking training',
    description: 'Foundational tracking training video supplied for the exercise library.',
    videoUrl: 'https://youtu.be/fhpCwZ3EL-c?si=lfibfmAEJM7SlO_H',
    progression: 'Progression video 1',
  },
  {
    id: 'tracking-2',
    title: 'Cervical Neutral Head Training',
    category: 'Tracking training',
    description: 'Neutral head training progression resource for cervical rehabilitation.',
    videoUrl: 'https://youtu.be/8vZMcVPOUac?si=z89jisdiZJvVrGTL',
    progression: 'Progression video 2',
  },
];

export const NECK_EXERCISE_CATEGORIES = [
  'All exercises',
  'Deep cervical flexor training',
  'Cervical isometric exercises',
  'Proprioceptive rehabilitation',
  'Tracking training',
] as const;
