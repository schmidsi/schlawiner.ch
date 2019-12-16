import { ApolloServer, gql } from 'apollo-server-micro';
import { google } from 'googleapis';

const CACHE_TIMEOUT = 100 * 1000;

const cache = {};

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

auth.setCredentials({
  access_token: process.env.GOOGLE_ACCESS_TOKEN,
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  expiry_date: process.env.GOOGLE_TOKEN_EXPIRY_DATE,
  scope: 'https://www.googleapis.com/auth/spreadsheets',
  token_type: 'Bearer',
});

const sheets = google.sheets({ version: 'v4', auth });

const getEntries = async forceRefetch => {
  const now = new Date();

  if (
    !forceRefetch &&
    cache.entries &&
    now - cache.entries.timestamp < CACHE_TIMEOUT
  ) {
    return cache.entries.data;
  }

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: '1LW3jwZED2ivelmt-VqrweqbEH3mN-okbLGQjO5X_qmE',
    range: 'A:Z',
    auth,
  });

  const entries = result.data.values.reduce(
    (acc, curr, index, self) =>
      index === 0
        ? acc
        : [
            Object.fromEntries(self[0].map((key, i) => [key.trim(), curr[i]])),
            ...acc,
          ],
    [],
  );

  cache.entries = {
    timestamp: new Date(),
    data: entries,
  };

  return entries;
};

const typeDefs = gql`
  type Query {
    isValidCode(code: String): Boolean
    greeting(code: String): String
    test: String
  }
`;

const resolvers = {
  Query: {
    async test(parent, args, context) {
      return process.env.TEST;
    },
    async isValidCode(_, { code }) {
      const entries = await getEntries();

      const entry = entries.find(e => e['code'] === code.trim().toLowerCase());

      return !!(entry && !entry['Timestamp']);
    },
    async greeting(_, { code }) {
      const entries = await getEntries();

      const entry = entries.find(e => e['code'] === code.trim().toLowerCase());

      if (entry) return entry['begruessung'];
      return '';
    },
  },
};

const apolloServer = new ApolloServer({ typeDefs, resolvers });

export default apolloServer;