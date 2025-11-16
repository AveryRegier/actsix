// import { Logger } from '@aws-lambda-powertools/logger';

// const logger = new Logger({ serviceName: 'actsix', logLevel: "DEBUG" });
// const logger = console.log;

// export {logger};

import { getLogger as getCloxLogger, Follower, addContext, addContexts } from 'clox';

const mainLogger = getCloxLogger({ name: 'actsix' });

export const getLogger = (context) => {
    return mainLogger.child(context || {});
};

export default mainLogger;

export function setLogLevel(level) {
    mainLogger.level = level;
}

const follower = new Follower(mainLogger);
const follow = async (fn, init, mapStatus) => follower.follow(fn, init, mapStatus);
follow.bind(follower);

export {follow, addContext, addContexts};
setLogLevel('debug');
