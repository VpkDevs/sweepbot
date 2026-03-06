// Example stub demonstrating how the browser extension might import the flows package

import { FlowInterpreter } from '@sweepbot/flows'

export async function interpretUserCommand(text: string, userId: string) {
  const interpreter = new FlowInterpreter()
  const result = await interpreter.interpret({ userId, rawInput: text })
  // extension could send this flow to the backend or store locally
  console.log('Interpreted flow', result.flow)
  return result.flow
}
