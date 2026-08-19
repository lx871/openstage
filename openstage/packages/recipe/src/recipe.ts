import type { PromptPlan } from '@openstage/contracts'
import { compilePrompt, type CompileInput } from '@openstage/context-engine'

export type RecipeMode = 'compat' | 'native'

export interface RecipeBudget {
  contextTokens: number
  reserveOutput: number
  lore: number
  examples: number
}

export interface Recipe {
  id: string
  mode: RecipeMode
  contextWindow: number
  reserveOutput: number
  loreBudgetRatio: number
  exampleBudgetRatio: number
  slots: Array<{ slot: string; role: string }>
  notes?: string
}

export function compatRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'compat-st-default',
    mode: 'compat',
    contextWindow: 8000,
    reserveOutput: 1024,
    loreBudgetRatio: 0.1,
    exampleBudgetRatio: 0.12,
    slots: [
      { slot: 'systemPrompt', role: 'system' },
      { slot: 'beforeChar', role: 'system' },
      { slot: 'beforeExamples', role: 'system' },
      { slot: 'afterExamples', role: 'system' },
      { slot: 'afterHistory', role: 'user' },
      { slot: 'postHistoryInstructions', role: 'system' },
    ],
    ...overrides,
  }
}

export function nativeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'native-modern',
    mode: 'native',
    contextWindow: 200000,
    reserveOutput: 4096,
    loreBudgetRatio: 0.08,
    exampleBudgetRatio: 0.05,
    slots: [
      { slot: 'systemPrompt', role: 'system' },
      { slot: 'beforeChar', role: 'system' },
      { slot: 'beforeExamples', role: 'system' },
      { slot: 'afterExamples', role: 'system' },
      { slot: 'afterHistory', role: 'user' },
      { slot: 'postHistoryInstructions', role: 'system' },
    ],
    ...overrides,
  }
}

export function recipeToCompileInput(recipe: Recipe, input: Omit<CompileInput, 'budget' | 'recipeId'>): CompileInput {
  return {
    ...input,
    recipeId: recipe.id,
    budget: { contextTokens: recipe.contextWindow, reserveOutput: recipe.reserveOutput },
  }
}

export function compileWithRecipe(recipe: Recipe, input: Omit<CompileInput, 'budget' | 'recipeId'>): ReturnType<typeof compilePrompt> {
  return compilePrompt(recipeToCompileInput(recipe, input))
}

export type { PromptPlan, CompileInput }
