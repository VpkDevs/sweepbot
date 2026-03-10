// Example stub showing how the backend API might use the flows package

import { FlowInterpreter } from '@sweepbot/flows'
import type { FlowDefinition } from '@sweepbot/flows'

// pretend this is inside an Express/Fastify route handler
export async function handleCreateFlow(req: any, res: any) {
  const { userId, description } = req.body

  const interpreter = new FlowInterpreter()
  const result = await interpreter.interpret({ userId, rawInput: description })

  const flow: FlowDefinition = {
    ...result.flow,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // here we would persist to the database and schedule the flow
  // await db.saveFlow(flow)
  // await scheduler.activateFlow(flow, userId)

  res.send({ success: true, data: flow })
}
