// Data model for the EduVerse explainer app.
// A prompt (+ optional attachments) becomes an Explainer: a scene script the
// player renders as a hand-drawn, voice-narrated "video".

export type Style = "linear" | "interactive";

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

export interface Course {
  id: string;
  studentId: string;
  title: string;
  topic: string;
  goals: string[];
  /** Extracted source text from attached docs, reused for every module. */
  docContext?: string;
  /** Web-grounded research brief, generated at outline time and reused per module. */
  research?: ResearchBrief;
  status: CourseStatus;
  modules: CourseModule[];
  createdAt: number;
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
  motivation?: string;
  goals: string[];
  learningStyle: LearningStyle;
  knownConcepts: ConceptStat[];
  weakConcepts: ConceptStat[];
  practiceHistory: LearningEvent[];
  mistakes: LearningEvent[];
  progress: CourseProgress[];
}
