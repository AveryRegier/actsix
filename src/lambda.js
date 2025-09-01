import { handle } from 'hono/aws-lambda'
import { createApp } from './api.js'

const app = createApp()

// Export the handler for AWS Lambda
export const handler = handle(app);
