import type { Bi } from "./prefs"

export type Day = {
  date: string; steps: number; active_min: number; kcal_out: number; distance_km: number; resting_hr: number
  sleep_min: number; sleep_score: number; deep: number; rem: number; light: number; awake: number
}
export type Stage = "deep" | "rem" | "light" | "awake"
export type Sleep = {
  bedtime: string; wake: string; minutes: number; score: number
  deep: number; rem: number; light: number; awake: number
  stages: { stage: Stage; start: number; minutes: number }[]
}
export type Food = { id: string; name: Bi; emoji: string; serving: Bi; kcal: number; protein: number; carbs: number; fat: number }
export type MealKind = "breakfast" | "lunch" | "dinner" | "snack"
export type Macros = { kcal: number; protein: number; carbs: number; fat: number }
export type MealItem = Macros & { id: number; food_id: string; servings: number; meal: MealKind; food: Food }
export type Today = {
  user: { name: Bi; device: string; battery: number; plan: string }
  goals: { steps: number; active_min: number; sleep_min: number; kcal_in: number; water: number }
  today: Day; sleep: Sleep; hourly_steps: number[]; heart: { t: string; bpm: number }[]
  intake: Macros; water: number; streak: number; week: Day[]
  insights: { kind: "sleep" | "move" | "eat"; text: Bi }[]
}

export const STAGE_COLOR: Record<Stage, string> = {
  deep: "var(--sleep)", rem: "#bf5af2", light: "var(--water)", awake: "var(--eat)",
}
