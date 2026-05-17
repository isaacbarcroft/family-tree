export const STORY_PROMPT_CATEGORIES = [
  "childhood",
  "family",
  "milestones",
  "places",
  "food",
  "beliefs",
  "hobbies",
] as const

export type StoryPromptCategory = (typeof STORY_PROMPT_CATEGORIES)[number]

export const STORY_PROMPT_CATEGORY_LABELS: Record<StoryPromptCategory, string> = {
  childhood: "Childhood",
  family: "Family",
  milestones: "Milestones",
  places: "Places",
  food: "Food",
  beliefs: "Beliefs",
  hobbies: "Hobbies",
}
