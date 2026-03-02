/**
 * Flow Executor - Runtime execution engine
 * Executes Flow AST nodes, maintains execution context, enforces guardrails
 */
export class FlowExecutor {
    /**
     * Execute a Flow definition
     * Returns the final execution context with all logs and metrics
     */
    async execute(flowDefinition, userId, context) {
        const executionContext = {
            flowId: flowDefinition.id,
            executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            variables: new Map(context || {}),
            startedAt: new Date(),
            currentNode: flowDefinition.rootNode.id,
            status: 'running',
            log: [],
            metrics: {
                totalDuration: 0,
                actionsExecuted: 0,
                conditionsEvaluated: 0,
                loopIterations: 0,
                platformsAccessed: [],
                bonusesClaimed: 0,
                bonusValueClaimed: 0,
                spinsExecuted: 0,
                totalWagered: 0,
                totalWon: 0,
                netResult: 0,
                guardrailsTriggered: [],
            },
        };
        // Check responsible play before execution
        const rpGuards = flowDefinition.responsiblePlayGuardrails;
        const cooldownGuard = rpGuards.find((g) => g.type === 'cool_down_check');
        if (cooldownGuard && cooldownGuard.value === true) {
            executionContext.log.push({
                timestamp: new Date(),
                nodeId: 'root',
                type: 'guardrail_triggered',
                details: { guardrail: 'cool_down_check' },
            });
            executionContext.status = 'stopped_by_guardrail';
            return executionContext;
        }
        try {
            // Execute the root node
            await this.executeNode(flowDefinition.rootNode, executionContext, flowDefinition);
            executionContext.status = 'completed';
        }
        catch (error) {
            executionContext.log.push({
                timestamp: new Date(),
                nodeId: executionContext.currentNode,
                type: 'error',
                details: { error: String(error) },
            });
            executionContext.status = 'failed';
        }
        // Calculate total duration
        executionContext.metrics.totalDuration = Date.now() - executionContext.startedAt.getTime();
        return executionContext;
    }
    /**
     * Execute a single node (recursive)
     */
    async executeNode(node, ctx, flow) {
        ctx.currentNode = node.id;
        switch (node.type) {
            case 'action':
                return await this.executeAction(node, ctx);
            case 'condition':
                return await this.executeCondition(node, ctx, flow);
            case 'loop':
                return await this.executeLoop(node, ctx, flow);
            case 'sequence':
                return await this.executeSequence(node, ctx, flow);
            case 'stop':
                ctx.status = 'completed';
                return;
            case 'alert':
                ctx.log.push({
                    timestamp: new Date(),
                    nodeId: node.id,
                    type: 'user_alert',
                    details: { message: node.message },
                });
                return;
            case 'wait':
                await new Promise((resolve) => setTimeout(resolve, node.duration));
                return;
            case 'store':
                const storeNode = node;
                const value = await this.evaluateValue(storeNode.value, ctx);
                ctx.variables.set(storeNode.variable, value);
                ctx.log.push({
                    timestamp: new Date(),
                    nodeId: node.id,
                    type: 'variable_set',
                    details: { variable: storeNode.variable, value },
                });
                return;
        }
    }
    /**
     * Execute an action node
     */
    async executeAction(node, ctx) {
        ctx.log.push({
            timestamp: new Date(),
            nodeId: node.id,
            type: 'action_start',
            details: { action: node.action, parameters: node.parameters },
        });
        try {
            // Execute the action (in real implementation, this calls the automation engine)
            const result = await this.executeAction_Impl(node, ctx);
            // Update metrics based on action type
            ctx.metrics.actionsExecuted++;
            if (node.action === 'claim_bonus') {
                ctx.metrics.bonusesClaimed++;
                if (typeof result === 'number') {
                    ctx.metrics.bonusValueClaimed += result;
                }
            }
            if (node.action === 'spin') {
                ctx.metrics.spinsExecuted++;
            }
            if (node.action === 'open_platform' && node.platform) {
                if (!ctx.metrics.platformsAccessed.includes(node.platform)) {
                    ctx.metrics.platformsAccessed.push(node.platform);
                }
            }
            // Store result if requested
            if (node.parameters.storeAs) {
                ctx.variables.set(node.parameters.storeAs, result);
            }
            ctx.log.push({
                timestamp: new Date(),
                nodeId: node.id,
                type: 'action_complete',
                details: result,
            });
            // Execute next node
            if (node.next) {
                await this.executeNode(node.next, ctx, {});
            }
        }
        catch (error) {
            ctx.log.push({
                timestamp: new Date(),
                nodeId: node.id,
                type: 'action_failed',
                details: { error: String(error) },
            });
            // Handle failure per node configuration
            if (node.onFailure === 'skip') {
                if (node.next) {
                    await this.executeNode(node.next, ctx, {});
                }
            }
            else if (node.onFailure === 'stop') {
                throw error;
            }
            // retry and fallback node not implemented for brevity
        }
    }
    /**
     * Execute a condition node
     */
    async executeCondition(node, ctx, flow) {
        const left = await this.evaluateValue(node.left, ctx);
        const right = await this.evaluateValue(node.right, ctx);
        const conditionMet = this.evaluateOperator(node.operator, left, right);
        ctx.log.push({
            timestamp: new Date(),
            nodeId: node.id,
            type: 'condition_evaluated',
            details: { left, operator: node.operator, right, result: conditionMet },
        });
        ctx.metrics.conditionsEvaluated++;
        const nextNode = conditionMet ? node.onTrue : node.onFalse;
        if (nextNode) {
            await this.executeNode(nextNode, ctx, flow);
        }
    }
    /**
     * Execute a loop node
     */
    async executeLoop(node, ctx, flow) {
        const loopStartTime = Date.now();
        let iterationCount = 0;
        while (iterationCount < node.maxIterations &&
            Date.now() - loopStartTime < node.maxDuration) {
            // Evaluate condition
            const left = await this.evaluateValue(node.condition.left, ctx);
            const right = await this.evaluateValue(node.condition.right, ctx);
            const conditionMet = this.evaluateOperator(node.condition.operator, left, right);
            if (!conditionMet)
                break;
            // Execute loop body
            await this.executeNode(node.body, ctx, flow);
            iterationCount++;
            ctx.log.push({
                timestamp: new Date(),
                nodeId: node.id,
                type: 'loop_iteration',
                details: { iteration: iterationCount, conditionMet },
            });
            ctx.metrics.loopIterations++;
        }
        // Log if we hit a cap
        if (iterationCount >= node.maxIterations || Date.now() - loopStartTime >= node.maxDuration) {
            ctx.log.push({
                timestamp: new Date(),
                nodeId: node.id,
                type: 'guardrail_triggered',
                details: { guardrail: 'loop_cap', iterations: iterationCount },
            });
            ctx.metrics.guardrailsTriggered.push('loop_cap');
        }
    }
    /**
     * Execute a sequence node (multiple steps in order)
     */
    async executeSequence(node, ctx, flow) {
        for (const step of node.steps) {
            await this.executeNode(step, ctx, flow);
        }
    }
    /**
     * Evaluate a FlowValue to get its actual value
     */
    async evaluateValue(value, ctx) {
        if (value.type === 'literal') {
            return value.value;
        }
        if (value.type === 'variable') {
            return ctx.variables.get(value.name);
        }
        if (value.type === 'expression') {
            // Simple expression evaluation (would use a proper parser in production)
            return this.evaluateExpression(value.expression, ctx);
        }
        if (value.type === 'query') {
            // Query result evaluation (would query the automation engine)
            return this.evaluateQuery(value.query, ctx);
        }
        return null;
    }
    /**
     * Evaluate a comparison operator
     */
    evaluateOperator(operator, left, right) {
        const l = typeof left === 'number' ? left : Number(left);
        const r = typeof right === 'number' ? right : Number(right);
        switch (operator) {
            case '>':
                return l > r;
            case '<':
                return l < r;
            case '>=':
                return l >= r;
            case '<=':
                return l <= r;
            case '==':
                return l === r;
            case '!=':
                return l !== r;
            case 'contains':
                return String(left).includes(String(right));
            case 'exists':
                return left !== null && left !== undefined;
            default:
                return false;
        }
    }
    /**
     * Simple expression evaluation
     * In production, would use a proper math expression parser
     */
    evaluateExpression(expr, ctx) {
        // Replace variables with their values
        let evaluated = expr;
        for (const [varName, value] of ctx.variables) {
            if (typeof value === 'number') {
                evaluated = evaluated.replace(`$${varName}`, String(value));
            }
        }
        // Simple safe evaluation
        try {
            // eslint-disable-next-line no-new-func
            return new Function(`return ${evaluated}`)();
        }
        catch {
            return 0;
        }
    }
    /**
     * Query result evaluation (stub for real implementation)
     */
    evaluateQuery(_query, _ctx) {
        // In production, would query the automation engine or database
        // For now, return null
        return null;
    }
    /**
     * Execute an action (stub for real implementation)
     * In production, would call the browser extension or backend service
     */
    async executeAction_Impl(node, _ctx) {
        // Simulate different action outcomes
        switch (node.action) {
            case 'claim_bonus':
                return Math.random() * 100; // Simulate bonus amount
            case 'spin':
                return { spins: 1, win: Math.random() * 500 };
            case 'check_balance':
                return Math.random() * 1000;
            case 'open_platform':
            case 'login':
            case 'open_game':
            case 'close_platform':
                return { success: true };
            default:
                return { success: true };
        }
    }
}
//# sourceMappingURL=executor.js.map