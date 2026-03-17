/**
 * Flow Executor - Runtime execution engine
 * Executes Flow AST nodes, maintains execution context, enforces guardrails
 */
import type { FlowDefinition, FlowExecutionContext } from '../types'
export declare class FlowExecutor {
  /**
   * Execute a Flow definition
   * Returns the final execution context with all logs and metrics
   */
  execute(
    flowDefinition: FlowDefinition,
    userId: string,
    context?: Record<string, unknown>
  ): Promise<FlowExecutionContext>
  /**
   * Execute a single node (recursive)
   */
  private executeNode
  /**
   * Execute an action node
   */
  private executeAction
  /**
   * Execute a condition node
   */
  private executeCondition
  /**
   * Execute a loop node
   */
  private executeLoop
  /**
   * Execute a sequence node (multiple steps in order)
   */
  private executeSequence
  /**
   * Evaluate a FlowValue to get its actual value
   */
  private evaluateValue
  /**
   * Evaluate a comparison operator
   */
  private evaluateOperator
  /**
   * Simple expression evaluation
   * In production, would use a proper math expression parser
   */
  private evaluateExpression
  /**
   * Query result evaluation (stub for real implementation)
   */
  private evaluateQuery
  /**
   * Execute an action (stub for real implementation)
   * In production, would call the browser extension or backend service
   */
  private executeAction_Impl
}
//# sourceMappingURL=executor.d.ts.map
