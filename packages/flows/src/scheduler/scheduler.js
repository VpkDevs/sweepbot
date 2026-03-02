/**
 * Flow Scheduler - Cron-based scheduling
 * Manages scheduled Flow executions using node-cron
 * Integrates with FlowExecutor to trigger flows on schedule
 */
// Using dynamic import for node-cron to avoid issues with ESM
let CronJob;
let cronSchedule;
async function loadCron() {
    if (!CronJob) {
        const cron = await import('node-cron');
        CronJob = cron.schedule;
        cronSchedule = cron;
    }
}
export class FlowScheduler {
    jobs = new Map();
    options;
    logger;
    constructor(options = {}) {
        this.options = options;
        this.logger = options.logger || {
            info: (msg) => console.log(`[FlowScheduler] ${msg}`),
            error: (msg, err) => console.error(`[FlowScheduler] ${msg}`, err),
        };
    }
    /**
     * Activate a Flow for scheduled execution
     * Only works if flow.trigger.type === 'scheduled'
     */
    async activateFlow(flow, userId) {
        if (flow.trigger.type !== 'scheduled') {
            this.logger.info(`Flow ${flow.id} is not scheduled (trigger: ${flow.trigger.type}), skipping`);
            return;
        }
        await loadCron();
        const { cron, timezone } = flow.trigger;
        const jobKey = `${userId}:${flow.id}`;
        // Remove existing job if it exists
        await this.pauseFlow(flow.id);
        try {
            // Create cron job
            const job = CronJob(cron, async () => {
                try {
                    this.logger.info(`Executing scheduled flow ${flow.id} for user ${userId}`);
                    if (this.options.onFlowExecute) {
                        await this.options.onFlowExecute(flow.id, userId);
                    }
                }
                catch (error) {
                    this.logger.error(`Flow ${flow.id} execution failed`, error);
                    if (this.options.onFlowError) {
                        await this.options.onFlowError(flow.id, userId, error);
                    }
                }
            });
            // Start the job
            job.start();
            this.jobs.set(jobKey, job);
            this.logger.info(`Flow ${flow.id} scheduled: cron="${cron}" timezone="${timezone}" for user ${userId}`);
        }
        catch (error) {
            this.logger.error(`Failed to schedule flow ${flow.id}`, error);
            throw new Error(`Failed to schedule flow: ${error.message}`);
        }
    }
    /**
     * Pause a scheduled Flow
     * Stops the cron job but keeps the flow's scheduled status
     */
    async pauseFlow(flowId) {
        // Find and stop all jobs for this flow (across all users)
        for (const [jobKey, job] of this.jobs.entries()) {
            if (jobKey.endsWith(`:${flowId}`)) {
                try {
                    job.stop();
                    this.jobs.delete(jobKey);
                    this.logger.info(`Paused flow ${flowId}`);
                }
                catch (error) {
                    this.logger.error(`Failed to pause flow ${flowId}`, error);
                }
            }
        }
    }
    /**
     * Resume a paused Flow
     * Re-activates the cron job
     */
    async resumeFlow(flow, userId) {
        await this.pauseFlow(flow.id);
        await this.activateFlow(flow, userId);
        this.logger.info(`Resumed flow ${flow.id} for user ${userId}`);
    }
    /**
     * Get status of a scheduled flow
     */
    getFlowStatus(flowId, userId) {
        const jobKey = `${userId}:${flowId}`;
        return this.jobs.has(jobKey) ? 'active' : 'paused';
    }
    /**
     * Reactivate all active flows from the database
     * Called on scheduler startup to restore all scheduled flows
     */
    async reactivateAllFlows(allFlows) {
        this.logger.info(`Reactivating ${allFlows.length} flows on startup`);
        let activatedCount = 0;
        for (const flow of allFlows) {
            if (flow.status === 'active' && flow.trigger.type === 'scheduled') {
                try {
                    await this.activateFlow(flow, flow.userId);
                    activatedCount++;
                }
                catch (error) {
                    this.logger.error(`Failed to reactivate flow ${flow.id}`, error);
                }
            }
        }
        this.logger.info(`Successfully reactivated ${activatedCount} flows`);
    }
    /**
     * Shutdown the scheduler gracefully
     * Stops all running cron jobs
     */
    async shutdown() {
        this.logger.info('Shutting down FlowScheduler...');
        for (const [jobKey, job] of this.jobs.entries()) {
            try {
                job.stop();
                this.jobs.delete(jobKey);
            }
            catch (error) {
                this.logger.error(`Failed to stop job ${jobKey}`, error);
            }
        }
        this.logger.info('FlowScheduler shutdown complete');
    }
    /**
     * Get list of all active scheduled flows
     */
    getActiveFlows() {
        return Array.from(this.jobs.keys());
    }
}
//# sourceMappingURL=scheduler.js.map