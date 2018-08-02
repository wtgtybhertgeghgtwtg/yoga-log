const expressPinoLogger = require('express-pino-logger');
const {GraphQLServer} = require('graphql-yoga');
const {Logger, MongoClient} = require('mongodb');
const pino = require('pino');

const databaseName = 'whatever';

const resolvers = {
  Query: {
    ping: (_, {word}, {logger}) => {
      // Use the child logger from context.
      logger.info('Logging something arbitrary here.');
      return word;
    },
  },
};

const typeDefs = `
  type Query {
    ping(word: String): String!
  }
`;

const url = 'mongodb://localhost:27017';

async function start() {
  // Create the logger with the level of 'info'.  You probably wanna configure the level with an environmental variable.
  const logger = pino({level: 'info'});

  Logger.setLevel('info');

  // Get logs from `mongo` and delegate them to your logger.
  Logger.setCurrentLogger((_, {message, type}) => {
    switch (type) {
      case 'debug': {
        // I really have no idea what kind of information `mongo` logs.  Might want to check to be sure you aren't logging anything sensitive.
        logger.debug(message);
        break;
      }
      case 'info': {
        logger.info(message);
        break;
      }
      case 'error': {
        logger.error(message);
        break;
      }
    }
  });

  // Connect to the client.  This should provide enough of a demonstration of the above logger.
  // This doesn't really do anything, so if it breaks, you can just erase these lines.
  const client = await MongoClient.connect(url);
  logger.info("Client's up.");
  // And then just pitch it.
  client.close();

  const server = new GraphQLServer({
    // Pass the child logger `pino` gives the request as context.
    context: ({request}) => ({logger: request.log}),
    resolvers,
    typeDefs,
  });

  // Have `pino` log stuff about requests (what's being requested, the headers, how long the request takes).
  server.express.use(expressPinoLogger({logger}));

  await server.start({
    // Get logs from `apollo` and delegate them to your logger.
    logFunction({data, key}) {
      // It'll give you a crapton of data on how queries are resolved, most of which you probably don't care about.
      // So, here's a simple filter of just logging queries.
      if (key === 'query') {
        // Again, be sure not to log anything sensitive.  But you really shouldn't have sensitive stuff in queries, anyway.
        logger.info({query: data}, 'Got a query!');
      }
    },
  });

  logger.info('Here we go!');
}

start();
