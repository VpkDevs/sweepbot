/**
 * Entity Recognizer - NLP-based entity extraction
 * Recognizes platforms, games, actions, conditions, schedules, amounts, durations from natural language
 * Uses rule-based matching (70-80% coverage) with LLM fallback for ambiguous cases
 */
import type {
  EntityMap,
  PlatformEntity,
  GameEntity,
  ActionEntity,
  ConditionEntity,
  ScheduleEntity,
  AmountEntity,
  DurationEntity,
} from '../types'
export declare class EntityRecognizer {
  private platformAliases
  private gameAliases
  /**
   * Extract platforms from text
   */
  extractPlatforms(text: string): PlatformEntity[]
  /**
   * Extract games from text
   */
  extractGames(text: string): GameEntity[]
  /**
   * Extract actions from text
   */
  extractActions(text: string): ActionEntity[]
  /**
   * Extract conditions from text
   * Looks for patterns like "if", "when", "unless", comparisons, etc.
   */
  extractConditions(text: string): ConditionEntity[]
  /**
   * Extract schedules from text
   * Parses "every day at 3:30", "weekdays", "once a week", etc.
   */
  extractSchedules(text: string): ScheduleEntity[]
  /**
   * Extract amounts from text
   * Parses "$50", "minimum bet", "5x the bonus", etc.
   */
  extractAmounts(text: string): AmountEntity[]
  /**
   * Extract durations from text
   * Parses "30 minutes", "2 hours", "100 spins", etc.
   */
  extractDurations(text: string): DurationEntity[]
  /**
   * Recognize all entities in the text
   */
  recognize(text: string): EntityMap
  /**
   * Extract variable references from text
   * Parses "$BONUS", "$BALANCE", etc.
   */
  private extractVariables
  /**
   * Helper: normalize hour to 24-hour format
   */
  private normalizeHour
}
//# sourceMappingURL=entity-recognizer.d.ts.map
