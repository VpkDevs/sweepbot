/**
 * Conversation Manager - Multi-turn Flow building
 * Handles back-and-forth refinement of Flows through natural conversation
 * Manages conversation state, interprets user refinements, and guides users toward complete flows
 */
import type { ConversationState, FlowDefinition } from '../types';
export interface ConversationManagerOptions {
    onStateSave?: (state: ConversationState) => Promise<void>;
    onStateLoad?: (conversationId: string) => Promise<ConversationState | null>;
    flowInterpreter?: any;
    logger?: {
        info: (msg: string) => void;
        error: (msg: string, err: any) => void;
    };
}
export declare class ConversationManager {
    private options;
    private logger;
    constructor(options?: ConversationManagerOptions);
    /**
     * Start a new conversation for Flow building
     */
    startConversation(userId: string, sessionId: string, initialFlowDescription: string): Promise<ConversationState>;
    /**
     * Continue an existing conversation
     * Process the user's new message and update the flow accordingly
     */
    continue(conversationId: string, userMessage: string): Promise<ConversationState>;
    /**
     * Confirm and save a completed Flow
     */
    confirm(conversationId: string): Promise<FlowDefinition>;
    /**
     * Detect what the user is trying to do with their message
     */
    private detectUpdateIntent;
    /**
     * Apply a user's refinement to the flow
     */
    private applyFlowRefinement;
    /**
     * Generate appropriate follow-up questions based on what we know so far
     */
    private generateFollowUpQuestions;
    /**
     * Check if a flow has all required fields
     */
    private isFlowComplete;
    /**
     * List missing required fields
     */
    private getMissingFields;
    /**
     * Answer a user's question about the Flow system
     */
    private answerFlowQuestion;
    /**
     * Generate a confirmation card showing the Flow summary
     */
    private generateConfirmationCard;
}
//# sourceMappingURL=conversation-manager.d.ts.map