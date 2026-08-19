// Data model for the EduVerse explainer app.
// A prompt (+ optional attachments) becomes an Explainer: a scene script the
// player renders as a hand-drawn, voice-narrated "video".

export type Style = "linear" | "interactive";

/**
 * Rendering fidelity.
 * - "fast": one generated illustration per scene, animated with entrances (default).
 * - "hifi": the scene is DRAWN as ordered edit-passes on one evolving canvas
 *   (title -> outline -> parts -> fills -> labels), giving genuine
 *   hand-drawn build-up keyframes. Much slower and pricier.
 */
export type Fidelity = "fast" | "hifi";

/** A single drawable primitive. The player animates these "drawing themselves". */
export type Element =
  | { kind: "text"; x: number; y: number; text: string; size?: number; weight?: "normal" | "bold" }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "arrow"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "path"; d: string }
  // A recognizable pre-drawn icon from the icon library, placed at (x,y) with
  // a bounding size. Drawn on like everything else.
  | { kind: "icon"; name: string; x: number; y: number; size: number };

export type ArtStyle = "flat" | "marker";

export type Entrance =
  | "fade"
  | "pop"
  | "grow"
  | "slideL"
  | "slideR"
  | "slideU"
  | "slideD"
  | "draw";

/** A generated illustration placed and animated on the stage. */
export interface SceneObject {
  id: string;
  /** Subject-only prompt for image generation (style/background added server-side). */
  prompt: string;
  x: number;
  y: number;
  w: number;
  h: number;
  entrance: Entrance;
  /** URL of the generated PNG/JPEG (filled after image generation). */
  imageUrl?: string;
  /** If set, reuse this extracted figure from the attachment instead of generating. */
  sourceFigureId?: string;
}

/** A citation to a source document (and page, when known). */
export interface Citation {
  source: string;
  page?: number;
}

// ---- Strategy A: coherent illustration + grounded beat reveal --------------

export type BeatOp = "intro" | "spotlight" | "annotate" | "zoom" | "dim";

/** One narration chunk bound to one visual move on the persistent scene. */
export interface Beat {
  say: string;
  op: BeatOp;
  /** Name of a grounded part this beat acts on (or null for a whole-scene beat). */
  target?: string;
  /** Optional short callout text. */
  label?: string;
}

/** A named region located in the generated scene image (canvas coords, 800x450). */
export interface GroundedPart {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A curved, colored connector between two objects (or explicit points). */
export interface Connector {
  from?: string;
  to?: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  color?: string;
  /** -1..1 curvature. */
  curve?: number;
  label?: string;
}

export interface VLabel {
  x: number;
  y: number;
  text: string;
  size?: number;
  weight?: "normal" | "bold";
  color?: string;
}

export interface Scene {
  id: string;
  /** What the narrator voice says during this scene. */
  narration: string;
  /** "A" = coherent image + grounded beats; "B" = composited objects/diagram. */
  strategy?: "A" | "B";
  // ---- Strategy A ----
  /** Prompt for the single coherent scene illustration. */
  imagePrompt?: string;
  /** URL of the generated coherent scene image. */
  sceneImageUrl?: string;
  /**
   * Hi-fi mode: ordered build-up frames of the SAME registered canvas, each one
   * the previous plus one drawn layer. The player reveals frame N+1 over frame N
   * with a sweeping mask, which reads as the new ink being drawn on.
   */
  keyframes?: string[];
  /** Grounded named regions in that image. */
  parts?: GroundedPart[];
  /** Beat timeline (narration ↔ visual moves). */
  beats?: Beat[];
  // ---- Strategy B (composited objects) ----
  /** Generated illustration objects (new engine). */
  objects?: SceneObject[];
  /** Curved colored connectors. */
  connectors?: Connector[];
  /** Vector text labels. */
  labels?: VLabel[];
  /** Legacy hand-drawn primitive elements (fallback engine). */
  elements?: Element[];
  /** Where this scene's content came from (attachment grounding). */
  citations?: Citation[];
  /** How long the scene runs (ms). Exact when TTS audio is present. */
  durationMs?: number;
  /** WAV data URL of narration audio (when server-side TTS succeeded). */
  audioUrl?: string;
}

/** One multiple-choice option. */
export interface QuizOption {
  id: string;
  text: string;
  /** One-line rationale for why this option is right or wrong (shown in review). */
  reason?: string;
}

/**
 * A checkpoint question for interactive mode. It fires when the scene at
 * `afterScene` finishes and gates progress: the learner cannot advance until
 * they answer correctly. Questions are generated seeing only the narration up
 * to their checkpoint, so they never reference material taught later.
 */
export interface Quiz {
  id: string;
  /** 0-based scene index this quiz fires after (checkpoint). */
  afterScene: number;
  /** True = one or more correct options; false = exactly one. */
  multi: boolean;
  question: string;
  options: QuizOption[];
  /** Option id(s) that count as correct. For `multi`, the set must match exactly. */
  correct: string[];
  /** Shown after every answer — right or wrong. */
  explanation: string;
  /** Short lowercase concept tag (standalone "quiz me" questions), for mastery tracking. */
  concept?: string;
}

export interface Explainer {
  id: string;
  title: string;
  style: Style;
  /** Illustration style chosen by the planner. */
  artStyle?: ArtStyle;
  scenes: Scene[];
  /** Interactive checkpoints (only present when style === "interactive"). */
  quizzes?: Quiz[];
  /** Source documents referenced (name + served URL for clickable citations). */
  sources?: { name: string; url?: string }[];
  /** Short label for the chat list. */
  createdFrom: string;
}

export interface Note {
  id: string;
  /** Timestamp in the explainer, ms. */
  tMs: number;
  text: string;
  /** Which explainer this note belongs to (so we can show its title). */
  explainerId: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Assistant messages carry the explainer they produced. */
  explainerId?: string;
  /** Names of files the user attached (user messages). */
  attachments?: string[];
}

/** One conversation. Users can keep several side by side. */
export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  explainers: Record<string, Explainer>;
  currentExplainerId: string | null;
  notes: Note[];
}

// Canonical drawing canvas (16:9).
export const CANVAS_W = 800;
export const CANVAS_H = 450;

// ---- Learning platform (courses + student profile) -------------------------

/** How the learner likes material delivered. Drives adaptive generation. */
export interface LearningStyle {
  /** Preferred pace of explanation. */
  pace?: "slow" | "normal" | "fast";
  /** How heavily to lean on analogies (0 none .. 3 lots). */
  analogies?: number;
  /** How many worked examples to include (0 none .. 3 lots). */
  examples?: number;
  /** Tone the learner responds to. */
  tone?: "playful" | "neutral" | "formal";
  /** Preferred illustration style. */
  artStyle?: ArtStyle;
  /** Free-form preferences the learner explicitly asked for (e.g. "use football analogies"). */
  notes?: string[];

}

/** A compact, prompt-ready description of the learner, injected into generation. */
export interface LearnerHint {
  style: LearningStyle;
  /** Concepts the learner is shaky on, to reinforce. */
  weakConcepts?: string[];
  /** What keeps them motivated (used to frame examples). */
  motivation?: string;
}

/** A concept the learner has touched, with a rolling strength score. */
export interface ConceptStat {
  name: string;
  status: "known" | "weak";
  /** 0..1 rolling mastery. */
  strength: number;
  updatedAt: number;
}

export type ModuleStatus = "locked" | "unlocked" | "in_progress" | "completed";

/** One unit of a course. Content is generated lazily and cached. */
export interface CourseModule {
  id: string;
  courseId: string;
  idx: number;
  title: string;
  summary: string;
  objectives: string[];
  status: ModuleStatus;
  /** The generated explainer for this module (filled on first generate). */
  explainer?: Explainer;
  // ---- certification mode: predefined required work ----
  /** Predefined quiz the learner must pass to complete the module (cert mode). */
  requiredQuiz?: Quiz[];
  /** Predefined assignment tasks the learner must submit + pass (cert mode). */
  requiredAssignment?: string[];
  /** Learner's typed answers to the required assignment (parallel to the tasks). */
  assignmentSubmission?: string[];
  /** Passed the required quiz? (cert-mode completion gate) */
  quizPassed: boolean;
  /** Passed the required assignment? (cert-mode completion gate) */
  assignmentPassed: boolean;
  createdAt: number;
  completedAt?: number;
}

/** Web-grounded research distilled for a course, feeding grounded, varied content. */
export interface ResearchBrief {
  summary: string;
  keyConcepts: string[];
  realWorldScenarios: string[];
  /** Diverse everyday domains to draw analogies from (deliberately NOT sports-default). */
  analogyDomains: string[];
  misconceptions: string[];
  sources: { title: string; url: string }[];
}

/** A timestamped note a learner takes while watching a module. */
export interface CourseNote {
  id: string;
  courseId: string;
  moduleId: string;
  /** Position in the module video, ms. */
  tMs: number;
  text: string;
  createdAt: number;
}

export type CourseStatus = "draft" | "active" | "completed";

/**
 * How a course is run.
 * - "self_eval": learner-controlled, no module locking, optional quizzes.
 * - "certification": sequential unlock, required quiz + assignment per module,
 *   a final exam, and a shareable certificate on passing.
 */
export type CourseMode = "self_eval" | "certification";

export interface Course {
  id: string;
  studentId: string;
  title: string;
  topic: string;
  goals: string[];
  /** Self-evaluation vs certification. */
  mode: CourseMode;
  /** Extracted source text from attached docs, reused for every module. */
  docContext?: string;
  /** Web-grounded research brief, generated at outline time and reused per module. */
  research?: ResearchBrief;
  status: CourseStatus;
  modules: CourseModule[];
  createdAt: number;
}

/** A per-task grade for an AI-graded assignment submission. */
export interface AssignmentTaskGrade {
  ok: boolean;
  feedback: string;
}

/** The result of grading an assignment submission. */
export interface AssignmentGrade {
  passed: boolean;
  /** 0..100 overall. */
  score: number;
  perTask: AssignmentTaskGrade[];
  overall: string;
}

/** An earned, shareable certificate for a completed certification course. */
export interface Certificate {
  id: string;
  courseId: string;
  courseTitle: string;
  learnerName: string;
  /** Exam score, 0..100. */
  score: number;
  issuedAt: number;
}

/** A take-home assignment produced on request. */
export interface Assignment {
  id: string;
  moduleId: string;
  tasks: string[];
  createdAt: number;
}

/** What the in-module assistant can be asked to do. */
export type InteractionType = "doubt" | "quiz" | "explain" | "assignment";

// ---- Adaptive Tutor: typed assessments -------------------------------------

/** Subject family, which decides the mix of assessment item types. */
export type AssessmentDomain = "coding" | "language" | "math" | "general";

/** The kinds of question/task an assessment can contain. */
export type AssessmentItemType =
  | "mcq"            // single-select multiple choice (auto-graded)
  | "multi_mcq"      // select-all-that-apply (auto-graded)
  | "fill_blank"     // fill in the blanks (auto-graded)
  | "short_answer"   // one or two sentences (AI-graded)
  | "code_bugfix"    // find + fix a bug in given code (AI-graded)
  | "code_write"     // write code to a spec, leetcode style (AI-graded)
  | "pseudocode"     // outline an algorithm in pseudocode (AI-graded)
  | "essay"          // longer writing task (AI-graded)
  | "math_multistep"; // multi-step problem, graded on approach + steps (AI-graded)

/** One assessment item. Auto-graded types carry `correct`; open types carry a hidden `rubric`. */
export interface AssessmentItem {
  id: string;
  type: AssessmentItemType;
  /** Which aspect of the topic this item probes. */
  aspect: string;
  /** The question or task shown to the learner. */
  prompt: string;
  /** MCQ options (mcq / multi_mcq). */
  options?: QuizOption[];
  /** Correct option id(s) for MCQ; expected fills (in order) for fill_blank. */
  correct?: string[];
  /** Programming language for code items. */
  language?: string;
  /** Buggy or starter code for code items. */
  starterCode?: string;
  /** What a correct answer must demonstrate (open items; used by the grader, hidden from the learner). */
  rubric?: string;
}

export interface Assessment {
  id: string;
  topic: string;
  domain: AssessmentDomain;
  level?: string;
  /** The aspects covered, in order. */
  aspects: string[];
  items: AssessmentItem[];
}

/** Per-item grade after submission. */
export interface AssessmentItemGrade {
  itemId: string;
  correct: boolean;
  /** 0..100. */
  score: number;
  feedback: string;
  /**
   * The UNDERLYING error, named (e.g. "adds digits without regrouping",
   * "ignores place value"). This is what remediation reasons over: knowing the
   * misconception is what lets us drop to the right prerequisite instead of
   * repeating the same lesson.
   */
  misconception?: string;
  /** What a correct answer needs that the learner did not show. */
  missingSkill?: string;
}

/**
 * A full record of one answered item, kept so later rounds can see WHAT the
 * learner actually got wrong rather than only which aspect tag failed.
 */
export interface AnswerEvidence {
  aspect: string;
  type: AssessmentItemType;
  question: string;
  learnerAnswer: string;
  expected?: string;
  correct: boolean;
  score: number;
  misconception?: string;
  missingSkill?: string;
}

/** The graded outcome of an assessment attempt. */
export interface AssessmentResult {
  perItem: AssessmentItemGrade[];
  /** Full per-item record (question, answer, verdict, misconception). */
  evidence?: AnswerEvidence[];
  perAspect: { aspect: string; score: number }[];
  /** 0..100 overall. */
  overall: number;
  passed: boolean;
  /** Aspects that fell below the mastery bar. */
  weakAspects: string[];
  summary: string;
}

/** A diagnosed weak area the recursive tutor can work on. */
export interface WeakArea {
  id: string;
  topic: string;
  aspect: string;
  domain: AssessmentDomain;
  level?: string;
  /** 0..1 rolling mastery. */
  mastery: number;
  status: "weak" | "learning" | "mastered";
  /** Spaced repetition: days until the next review. */
  intervalDays?: number;
  /** Spaced repetition ease factor (how fast the interval grows). */
  ease?: number;
  /** When this skill should be reviewed again. */
  dueAt?: number;
  /** How many successful reviews so far. */
  reviews?: number;
  updatedAt: number;
}

/**
 * A prerequisite ladder for one skill: what a learner must already be able to do
 * before the target skill makes sense, ordered EASIEST first. Grounded in US
 * grade-level scope and sequence.
 */
export interface PrereqStep {
  /** Short skill name, e.g. "single digit addition to 10". */
  skill: string;
  /** US grade band where this is normally taught, e.g. "Grade 1". */
  grade?: string;
  /** How to check the learner has it, in one line. */
  check: string;
}

export interface PrereqLadder {
  /** The skill the learner is trying to reach. */
  target: string;
  /** Easiest first, ending just below the target. */
  steps: PrereqStep[];
}

/**
 * The result of reasoning over a failed attempt: WHY they failed and WHAT to
 * teach next. `teachSkill` may sit well below the original aspect, which is the
 * whole point of the adaptive loop.
 */
export interface Diagnosis {
  /** The skill to teach in the next round (possibly a prerequisite). */
  teachSkill: string;
  /** True when we dropped below the original aspect to fix a foundation. */
  droppedDown: boolean;
  /** Named misconceptions seen in the evidence. */
  misconceptions: string[];
  /** Plain-language reason, shown to the learner so the drop feels intentional. */
  reason: string;
  /** How to pitch the lesson: what to assume and what to build from. */
  teachingNotes: string;
}

/** A completed diagnostic: level-calibrated map of understanding. */
export interface Diagnostic {
  id: string;
  topic: string;
  level?: string;
  domain: AssessmentDomain;
  perAspect: { aspect: string; score: number }[];
  /** 0..100 overall. */
  overall: number;
  /** A human label for where they stand, e.g. "Beginner"/"Proficient". */
  rank: string;
  status: "open" | "graded";
  createdAt: number;
}

/** A single practice-history / mistake record. */
export interface LearningEvent {
  id: string;
  moduleId?: string;
  type: string;
  concept?: string;
  isCorrect?: boolean;
  data?: unknown;
  createdAt: number;
}

/** Per-course progress snapshot. */
export interface CourseProgress {
  courseId: string;
  title: string;
  total: number;
  completed: number;
  status: CourseStatus;
}

/** The aggregated student profile shown on the dashboard + fed to generation. */
export interface StudentProfile {
  id: string;
  /** Display name, used on certificates. */
  name?: string;
  age?: number;
  gender?: string;
  /** Education level, drives level-calibrated diagnostics. */
  educationLevel?: string;
  motivation?: string;
  goals: string[];
  learningStyle: LearningStyle;
  knownConcepts: ConceptStat[];
  weakConcepts: ConceptStat[];
  practiceHistory: LearningEvent[];
  mistakes: LearningEvent[];
  progress: CourseProgress[];
  /** Certificates earned from certification courses. */
  certificates: Certificate[];
}
