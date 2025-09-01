import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'actsix', logLevel: "DEBUG" });

export {logger};