/**
 * Test Fixtures for SweepBot API
 * Provides pre-built test scenarios and common test data
 */

import {
  createTestUser,
  createTestSubscription,
  createTestFlow,
  createTestFlowExecution,
  type TestUser,
  type TestSubscription,
  type TestFlow,
  type TestFlowExecution,
} from '../setup'

/* ─────────────────────────────────────────────────────────────────────────── */
/* Standard Test Users */
/* ─────────────────────────────────────────────────────────────────────────── */

export const FIXTURE_USERS = {
  /** Free tier user with no subscription */
  FREE_USER: createTestUser({
    id: 'user-free-001',
    email: 'free@example.com',
    tier: 'free',
  }),

  /** Starter tier user with active subscription */
  STARTER_USER: createTestUser({
    id: 'user--starter-001',
    email: 'starter@example.com',
    tier: 'starter',
  }),

  /** Pro tier user with premium features */
  PRO_USER: createTestUser({
    id: 'user-pro-001',
    email: 'pro@example.com',
    tier: 'pro',
  }),

  /** User with specific email for testing */
  TEST_EMAIL_USER: createTestUser({
    id: 'user-email-001',
    email: 'test-specific@example.com',
    tier: 'starter',
  }),

  /** Second user for concurrent/multi-user tests */
  USER_2: createTestUser({
    id: 'user-second-001',
    email: 'user2@example.com',
    tier: 'free',
  }),

  /** Third user for testing isolation */
  USER_3: createTestUser({
    id: 'user-third-001',
    email: 'user3@example.com',
    tier: 'pro',
  }),
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Standard Test Subscriptions */
/* ─────────────────────────────────────────────────────────────────────────── */

export const FIXTURE_SUBSCRIPTIONS = {
  /** Active starter subscription */
  ACTIVE_STARTER: createTestSubscription({
    userId: 'user-starter-001',
    stripeId: 'sub_active_starter_001',
    stripeCustomerId: 'cus_starter_001',
    tier: 'starter',
    status: 'active',
  }),

  /** Canceled subscription (for testing downgrade flows) */
  CANCELED: createTestSubscription({
    userId: 'user-free-001',
    stripeId: 'sub_canceled_001',
    stripeCustomerId: 'cus_free_001',
    tier: 'starter',
    status: 'canceled',
  }),

  /** Trialing subscription (not yet charged) */
  TRIALING: createTestSubscription({
    userId: 'user-pro-001',
    stripeId: 'sub_trial_001',
    stripeCustomerId: 'cus_pro_001',
    tier: 'pro',
    status: 'trailing',
  }),

  /** On hold subscription (payment issue) */
  ON_HOLD: createTestSubscription({
    userId: 'user-third-001',
    stripeId: 'sub_hold_001',
    stripeCustomerId: 'cus_hold_001',
    tier: 'starter',
    status: 'on_hold',
  }),
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Standard Test Flows */
/* ─────────────────────────────────────────────────────────────────────────── */

export const FIXTURE_FLOWS = {
  /** Simple daily automation flow */
  DAILY_AUTOMATION: createTestFlow({
    id: 'flow-daily-001',
    userId: 'user-starter-001',
    name: 'Daily Routine',
    description: 'Open Chumba and claim daily bonus every morning',
    status: 'active',
    definition: {
      type: 'sequence',
      trigger: { type: 'schedule', cronExpression: '0 9 * * *' },
      steps: [
        { type: 'action', action: 'open_platform', platform: 'chumba' },
        { type: 'action', action: 'claim_bonus' },
        { type: 'wait', duration: 5000 },
        { type: 'action', action: 'check_balance' },
      ],
    },
  }),

  /** Complex flow with conditions */
  CONDITIONAL_FLOW: createTestFlow({
    id: 'flow-conditional-001',
    userId: 'user-pro-001',
    name: 'Smart Gaming',
    description: 'Only play if balance is above threshold',
    status: 'active',
    definition: {
      type: 'sequence',
      steps: [
        {
          type: 'condition',
          operator: 'greaterThan',
          leftOperand: { type: 'variable', name: 'balance' },
          rightOperand: { type: 'literal', value: 100 },
          trueBranch: [
            { type: 'action', action: 'play_game', game: 'lucky-slots' },
          ],
          falseBranch: [
            { type: 'alert', message: 'Balance too low, skipping play' },
          ],
        },
      ],
    },
  }),

  /** Draft flow (not yet activated) */
  DRAFT_FLOW: createTestFlow({
    id: 'flow-draft-001',
    userId: 'user-free-001',
    name: 'Experiment Flow',
    description: 'Work in progress',
    status: 'draft',
    definition: { type: 'sequence', steps: [] },
  }),

  /** Paused flow (was active, now paused) */
  PAUSED_FLOW: createTestFlow({
    id: 'flow-paused-001',
    userId: 'user-third-001',
    name: 'Seasonal Flow',
    description: 'Paused until next season',
    status: 'paused',
    definition: {
      type: 'sequence',
      steps: [{ type: 'action', action: 'check_promotions' }],
    },
  }),

  /** Flow with responsible play guardrails */
  GUARDRAILED_FLOW: createTestFlow({
    id: 'flow-guarded-001',
    userId: 'user-starter-001',
    name: 'Responsible Gaming',
    description: 'Limited to 1 hour per session',
    status: 'active',
    definition: {
      type: 'sequence',
      guardrails: {
        maxSessionDuration: 3600000, // 1 hour
        maxDailyLoss: 5000,
        enableChaseDetection: true,
        cooldownPeriod: 300000, // 5 min between sessions
      },
      steps: [{ type: 'action', action: 'play_game' }],
    },
  }),
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Standard Test Flow Executions */
/* ─────────────────────────────────────────────────────────────────────────── */

export const FIXTURE_FLOW_EXECUTIONS = {
  /** Successful execution with metrics */
  SUCCESSFUL_EXEC: createTestFlowExecution({
    id: 'exec-success-001',
    flowId: 'flow-daily-001',
    userId: 'user-starter-001',
    status: 'completed',
    metrics: {
      duration: 5000,
      actions_completed: 4,
      errors: 0,
      started_at: new Date(Date.now() - 10000),
      completed_at: new Date(),
    },
  }),

  /** Failed execution with error details */
  FAILED_EXEC: createTestFlowExecution({
    id: 'exec-failed-001',
    flowId: 'flow-conditional-001',
    userId: 'user-pro-001',
    status: 'failed',
    errorDetails: 'Platform connection timeout after 30s',
    metrics: {
      duration: 30000,
      actions_completed: 1,
      errors: 1,
    },
  }),

  /** Running execution (no completion time yet) */
  RUNNING_EXEC: createTestFlowExecution({
    id: 'exec-running-001',
    flowId: 'flow-daily-001',
    userId: 'user-starter-001',
    status: 'running',
    metrics: {
      duration: 0,
      actions_completed: 2,
      errors: 0,
    },
  }),

  /** Paused execution (can be resumed) */
  PAUSED_EXEC: createTestFlowExecution({
    id: 'exec-paused-001',
    flowId: 'flow-guarded-001',
    userId: 'user-starter-001',
    status: 'paused',
    metrics: {
      duration: 120000,
      actions_completed: 3,
      errors: 0,
      paused_at: new Date(),
    },
  }),
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Test Scenarios: Multi-step test data setups */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Scenario: User signs up and creates first flow
 * Returns user + flow ready for testing execution
 */
export function getScenarioNewUserWithFlow(): {
  user: TestUser
  flow: TestFlow
} {
  return {
    user: FIXTURE_USERS.STARTER_USER,
    flow: FIXTURE_FLOWS.DAILY_AUTOMATION,
  }
}

/**
 * Scenario: User with multiple flows in different states
 * Returns user + multiple flows for testing listing/filtering
 */
export function getScenarioUserWithMultipleFlows(): {
  user: TestUser
  flows: TestFlow[]
} {
  return {
    user: FIXTURE_USERS.PRO_USER,
    flows: [
      FIXTURE_FLOWS.DAILY_AUTOMATION,
      FIXTURE_FLOWS.CONDITIONAL_FLOW,
      FIXTURE_FLOWS.DRAFT_FLOW,
    ],
  }
}

/**
 * Scenario: User with execution history
 * Returns user + flow + multiple executions for testing analytics
 */
export function getScenarioUserWithExecutionHistory(): {
  user: TestUser
  flow: TestFlow
  executions: TestFlowExecution[]
} {
  return {
    user: FIXTURE_USERS.STARTER_USER,
    flow: FIXTURE_FLOWS.DAILY_AUTOMATION,
    executions: [
      FIXTURE_FLOW_EXECUTIONS.SUCCESSFUL_EXEC,
      FIXTURE_FLOW_EXECUTIONS.FAILED_EXEC,
      FIXTURE_FLOW_EXECUTIONS.RUNNING_EXEC,
    ],
  }
}

/**
 * Scenario: Multiple concurrent users for testing isolation
 * Returns 3 users with their respective flows/subscriptions
 */
export function getScenarioConcurrentUsers(): {
  users: TestUser[]
  subscriptions: TestSubscription[]
  flows: TestFlow[]
} {
  return {
    users: [
      FIXTURE_USERS.STARTER_USER,
      FIXTURE_USERS.PRO_USER,
      FIXTURE_USERS.USER_3,
    ],
    subscriptions: [
      FIXTURE_SUBSCRIPTIONS.ACTIVE_STARTER,
      FIXTURE_SUBSCRIPTIONS.TRIALING,
      FIXTURE_SUBSCRIPTIONS.ON_HOLD,
    ],
    flows: [
      FIXTURE_FLOWS.DAILY_AUTOMATION,
      FIXTURE_FLOWS.CONDITIONAL_FLOW,
      FIXTURE_FLOWS.GUARDRAILED_FLOW,
    ],
  }
}

/**
 * Scenario: Data integrity test setup
 * Returns user with flows/executions forming potential integrity issues
 */
export function getScenarioDataIntegrityMatrix(): {
  orphanedFlows: TestFlow[]
  invalidFlowExecutions: TestFlowExecution[]
  wellformedData: {
    user: TestUser
    flow: TestFlow
    execution: TestFlowExecution
  }
} {
  return {
    orphanedFlows: [
      createTestFlow({
        id: 'orphaned-flow-001',
        userId: 'non-existent-user-xyz',
      }),
    ],
    invalidFlowExecutions: [
      createTestFlowExecution({
        id: 'orphaned-exec-001',
        flowId: 'non-existent-flow-xyz',
      }),
    ],
    wellformedData: {
      user: FIXTURE_USERS.STARTER_USER,
      flow: FIXTURE_FLOWS.DAILY_AUTOMATION,
      execution: FIXTURE_FLOW_EXECUTIONS.SUCCESSFUL_EXEC,
    },
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Token/Auth Fixtures */
/* ─────────────────────────────────────────────────────────────────────────── */

export const FIXTURE_AUTH = {
  /** Valid JWT token for testing */
  VALID_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.valid',

  /** Expired JWT token */
  EXPIRED_TOKEN:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.expired_long_ago',

  /** Invalid/corrupted JWT token */
  INVALID_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.corrupted',

  /** Authorization header with valid token */
  VALID_AUTH_HEADER: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.valid',

  /** Missing authorization header value */
  MISSING_AUTH_HEADER: '',

  /** Malformed authorization header (missing "Bearer" prefix) */
  MALFORMED_AUTH_HEADER: 'NotBearer token123',
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Stripe Event Fixtures */
/* ─────────────────────────────────────────────────────────────────────────── */

export const FIXTURE_STRIPE_EVENTS = {
  CUSTOMER_CREATED: {
    type: 'customer.created',
    data: {
      object: {
        id: 'cus_stripe_001',
        email: 'test@example.com',
        metadata: { user_id: 'user-starter-001' },
      },
    },
  },

  SUBSCRIPTION_CREATED: {
    type: 'customer.subscription.created',
    data: {
      object: {
        id: 'sub_stripe_001',
        customer: 'cus_stripe_001',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      },
    },
  },

  SUBSCRIPTION_UPDATED: {
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_stripe_001',
        status: 'past_due',
      },
    },
  },

  PAYMENT_SUCCEEDED: {
    type: 'charge.succeeded',
    data: {
      object: {
        id: 'ch_stripe_success',
        customer: 'cus_stripe_001',
        amount: 999,
        currency: 'usd',
        status: 'succeeded',
      },
    },
  },

  PAYMENT_FAILED: {
    type: 'charge.failed',
    data: {
      object: {
        id: 'ch_stripe_failed',
        customer: 'cus_stripe_001',
        amount: 999,
        status: 'failed',
      },
    },
  },
}
