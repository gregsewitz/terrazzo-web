import Nylas from 'nylas';

const nylas = new Nylas({
  apiKey: process.env.NYLAS_API_KEY || '',
});

export function getNylasAuthUrl(redirectUri: string) {
  return nylas.auth.urlForOAuth2({
    clientId: process.env.NYLAS_CLIENT_ID || '',
    redirectUri,
    loginHint: '',
  });
}

export async function exchangeCodeForGrant(code: string, redirectUri: string) {
  const response = await nylas.auth.exchangeCodeForToken({
    clientId: process.env.NYLAS_CLIENT_ID || '',
    code,
    redirectUri,
  });
  return response;
}

export async function searchEmails(grantId: string, query: string) {
  const messages = await nylas.messages.list({
    identifier: grantId,
    queryParams: {
      limit: 50,
      searchQueryNative: query,
    },
  });
  return messages;
}

export default nylas;
