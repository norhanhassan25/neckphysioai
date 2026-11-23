import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { many, one } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import * as users from '../services/users.js';

export const neckRouter = Router();
const answersSchema = z.object({
  pain: z.number().int().min(0).max(10),
  area: z.enum(['left','right','center','both']),
  duration: z.enum(['recent','weeks','long']),
  restriction: z.boolean(),
  painfulMovement: z.enum(['left','right','both','none']),
  clinicianApproved: z.boolean().optional(), // legacy field; no patient-by-patient approval required
  warningSymptoms: z.array(z.enum(['dizziness','numbness','weakness','severe_headache','recent_trauma'])).max(5),
  ndi: z.array(z.number().int().min(0).max(5).nullable()).length(10),
});
// Project demonstration protocol supplied by the project team. NDI is not, by itself,
// a clinically validated exercise prescription tool. Confirm this protocol with the
// responsible physiotherapist before using with real patients.
export function ndiVideoPlan(score: number): string[] {
  if (score >= 70) return [];
  if (score >= 50) return ['cervical-isometric', 'deep-flexor-1'];
  if (score >= 30) return ['deep-flexor-1', 'cervical-isometric'];
  if (score >= 10) return ['deep-flexor-2', 'tracking-1', 'tracking-2'];
  return ['deep-flexor-1', 'tracking-1'];
}
neckRouter.get('/exercises', asyncHandler(async (_req,res) => {
  res.json(await many('SELECT id, title, description, video_url AS "videoUrl", instructions,tracking_mode AS "trackingMode",exercise_group AS "exerciseGroup", plan_reps AS "planReps", plan_sets AS "planSets", plan_hold_seconds AS "planHoldSeconds", plan_rest_seconds AS "planRestSeconds" FROM neck_exercises WHERE active = TRUE ORDER BY title'));
}));
neckRouter.get('/assessment/latest', requireRole('patient'), asyncHandler(async (req,res) => {
  const row = await one<{id:number; answers:z.infer<typeof answersSchema>; status:string; exerciseId:string|null; createdAt:string}>('SELECT id, answers, status, exercise_id AS "exerciseId", created_at AS "createdAt" FROM neck_assessments WHERE user_id = $1 ORDER BY id DESC LIMIT 1',[req.auth.id]);
  if (!row) { res.json(null); return; }
  const completed = row.answers.ndi.filter((v):v is number => v !== null);
  const ndiPercent = completed.length >= 8 ? Math.round(completed.reduce((sum,v)=>sum+v,0)*100/(completed.length*5)*10)/10 : null;
  res.json({...row, ndiPercent, ndiTotal:completed.reduce((sum,v)=>sum+v,0), ndiMaximum:completed.length*5});
}));
neckRouter.post('/assessment', requireRole('patient'), asyncHandler(async (req,res) => {
  const parsed = answersSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Please complete the neck questionnaire with valid answers');
  const answered=parsed.data.ndi.filter((v):v is number=>v!==null);
  const ndiPercent=answered.length>=8?Math.round(answered.reduce((a,b)=>a+b,0)*100/(answered.length*5)*10)/10:null;
  // NDI is recorded as an outcome measure only. Do not infer exercise choice from it.
  const reason = parsed.data.warningSymptoms.length > 0 || parsed.data.pain >= 7 ? 'safety_review' : null;
  const row = await one(`INSERT INTO neck_assessments (user_id, answers, status, exercise_id)
    VALUES ($1,$2,$3,NULL) RETURNING id, status, exercise_id AS "exerciseId"`,
    [req.auth.id,JSON.stringify(parsed.data),reason ? 'review' : 'eligible']);
  res.status(201).json({...row,ndiPercent,ndiTotal:answered.reduce((sum,v)=>sum+v,0),ndiMaximum:answered.length*5,matchReason:reason ?? 'ndi_recorded'});
}));
neckRouter.get('/history', requireRole('patient'), asyncHandler(async(req,res) => {
  res.json(await many('SELECT * FROM neck_tracking_sessions WHERE user_id = $1 ORDER BY id DESC LIMIT 50',[req.auth.id]));
}));
const sessionSchema = z.object({
  assessmentId:z.number().int().positive().nullable().optional(),
  exerciseId:z.string().min(1).max(100),
  durationSeconds:z.number().int().min(0).max(7200),
  leftTurns:z.number().int().min(0).max(1000).default(0),
  rightTurns:z.number().int().min(0).max(1000).default(0),
  trackingQuality:z.enum(['good','limited','lost']),
  notes:z.array(z.string().max(150)).max(25)
});
neckRouter.post('/sessions', requireRole('patient'), asyncHandler(async(req,res) => {
  const parsed=sessionSchema.safeParse(req.body);
  if(!parsed.success)throw badRequest('Invalid tracking session');
  const {exerciseId,assessmentId,durationSeconds,leftTurns,rightTurns,trackingQuality,notes}=parsed.data;
  const exercise=await one<{id:string}>('SELECT id FROM neck_exercises WHERE id=$1 AND active=TRUE',[exerciseId]);
  if(!exercise)throw notFound('Exercise not available');
  const last=await one<{id:number;answers:z.infer<typeof answersSchema>}>(
    'SELECT id,answers FROM neck_assessments WHERE user_id=$1 ORDER BY id DESC LIMIT 1',[req.auth.id]);
  // Do not allow a requested assessment from another patient; check the latest safety screen.
  if(assessmentId && (!last||assessmentId!==Number(last.id)))throw forbidden('Invalid assessment');
  if(last&&(last.answers.warningSymptoms.length>0||last.answers.pain>=7))throw forbidden('Safety symptoms require clinical review');
  const row=await one(`INSERT INTO neck_tracking_sessions
    (user_id,exercise_id,assessment_id,duration_seconds,left_turns,right_turns,tracking_quality,notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [req.auth.id,exerciseId,last?.id??null,durationSeconds,leftTurns,rightTurns,trackingQuality,JSON.stringify(notes)]);
  res.status(201).json(row);
}));
neckRouter.get('/doctor/patients/:id', requireRole('doctor','admin'), asyncHandler(async(req,res) => {
  if (!(await users.canViewUser(req.auth,req.params.id))) throw notFound('Patient not found');
  const [assessments,sessions]=await Promise.all([
    many('SELECT * FROM neck_assessments WHERE user_id=$1 ORDER BY id DESC LIMIT 30',[req.params.id]),
    many('SELECT * FROM neck_tracking_sessions WHERE user_id=$1 ORDER BY id DESC LIMIT 30',[req.params.id])
  ]);
  res.json({assessments,sessions});
}));
neckRouter.get('/doctor/exercises', requireRole('doctor','admin'), asyncHandler(async(_req,res) => {
  res.json(await many('SELECT id, title, description, video_url AS "videoUrl", instructions, active, tracking_mode AS "trackingMode", exercise_group AS "exerciseGroup", rule_approved AS "ruleApproved", min_ndi AS "minNdi", max_ndi AS "maxNdi", rule_priority AS "rulePriority", plan_reps AS "planReps", plan_sets AS "planSets", plan_hold_seconds AS "planHoldSeconds", plan_rest_seconds AS "planRestSeconds" FROM neck_exercises ORDER BY title'));
}));
const exerciseSchema=z.object({
  title:z.string().min(3).max(120),
  description:z.string().max(500),
  instructions:z.string().max(1000),
  videoUrl:z.string().url().max(2000).nullable(),
  active:z.boolean(),
  ruleApproved:z.boolean().optional(),
  minNdi:z.number().int().min(0).max(100).optional(),
  maxNdi:z.number().int().min(0).max(100).optional(),
  rulePriority:z.number().int().min(0).max(9999).optional(),
  planReps:z.number().int().min(1).max(100).nullable().optional(),
  planSets:z.number().int().min(1).max(20).nullable().optional(),
  planHoldSeconds:z.number().int().min(0).max(120).nullable().optional(),
  planRestSeconds:z.number().int().min(0).max(300).nullable().optional(),
});
neckRouter.put('/doctor/exercises/:id', requireRole('doctor','admin'), asyncHandler(async(req,res) => {
  const parsed=exerciseSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Invalid exercise configuration');
  const e=parsed.data;
  if (e.videoUrl && !/^https:\/\//i.test(e.videoUrl)) throw badRequest('Use an HTTPS video URL');
  if(e.minNdi !== undefined && e.maxNdi !== undefined && e.minNdi>e.maxNdi) throw badRequest('Invalid NDI range');
  const row=await one(
    `UPDATE neck_exercises SET 
      title=$2, description=$3, instructions=$4, video_url=$5, active=$6, 
      rule_approved=$7, min_ndi=$8, max_ndi=$9, rule_priority=$10,
      plan_reps=$11, plan_sets=$12, plan_hold_seconds=$13, plan_rest_seconds=$14
     WHERE id=$1 RETURNING id`,
    [
      req.params.id, e.title, e.description, e.instructions, e.videoUrl, e.active, 
      e.ruleApproved??false, e.minNdi??0, e.maxNdi??100, e.rulePriority??100,
      e.planReps??null, e.planSets??null, e.planHoldSeconds??null, e.planRestSeconds??null
    ]
  );
  if (!row) throw notFound('Exercise not found');
  res.json(row);
}));
