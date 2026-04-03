import * as adminSsoConfigApi from '@/pages/api/support/user/admin/sso/config';
import * as ssoAuthUrlApi from '@/pages/api/support/user/account/login/sso/authUrl';
import * as ssoCallbackApi from '@/pages/api/support/user/account/login/sso/callback';
import jwt from 'jsonwebtoken';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { getRootUser, getUser } from '@test/datas/users';
import { Call } from '@test/utils/request';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

const redirectUri = 'http://localhost:3000/login/provider';
const tenantId = 'tenant-id';
const clientId = 'client-id';
const clientSecret = 'client-secret';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const saveConfig = async (root?: Awaited<ReturnType<typeof getRootUser>>) => {
  const auth = root || (await getRootUser());
  return Call<
    adminSsoConfigApi.adminGetSSOConfigBody,
    adminSsoConfigApi.adminGetSSOConfigQuery,
    adminSsoConfigApi.adminGetSSOConfigResponse
  >(adminSsoConfigApi.default, {
    auth,
    body: {
      enabled: true,
      tenantId,
      clientId,
      clientSecret,
      title: 'Contoso Login'
    },
    method: 'PUT'
  });
};

const getAuthUrl = async () => {
  return Call<ssoAuthUrlApi.ssoAuthUrlBody, ssoAuthUrlApi.ssoAuthUrlQuery, string>(
    ssoAuthUrlApi.default,
    {
      body: {
        redirectUri
      },
      method: 'POST'
    }
  );
};

describe('local entra sso api', () => {
  it('should allow root to save config and only expose masked/public data', async () => {
    const root = await getRootUser();
    const saveRes = await saveConfig(root);

    expect(saveRes.code).toBe(200);
    expect(saveRes.data.clientSecret).toBe('********');
    expect(saveRes.data.title).toBe('Contoso Login');

    const getRes = await Call<
      adminSsoConfigApi.adminGetSSOConfigBody,
      adminSsoConfigApi.adminGetSSOConfigQuery,
      adminSsoConfigApi.adminGetSSOConfigResponse
    >(adminSsoConfigApi.default, {
      auth: root,
      method: 'GET'
    });

    expect(getRes.code).toBe(200);
    expect(getRes.data.clientSecret).toBe('********');
    expect(global.authConfigs?.sso?.entra?.clientSecret).toBe(clientSecret);
    expect(global.feConfigs?.sso).toEqual({
      enabled: true,
      provider: 'entra',
      title: 'Contoso Login'
    });

    expect((global.feConfigs as Record<string, any>).authConfigs).toBeUndefined();
  });

  it('should reject non-root config access', async () => {
    const user = await getUser('member@example.com');

    const res = await Call(adminSsoConfigApi.default, {
      auth: user,
      method: 'GET'
    });

    expect(res.code).toBe(500);
  });

  it('should return an entra authorize url and write temp auth cookie', async () => {
    await saveConfig();

    const res = await getAuthUrl();

    expect(res.code).toBe(200);
    const url = new URL(res.data);
    expect(url.origin).toBe('https://login.microsoftonline.com');
    expect(url.pathname).toBe(`/${tenantId}/oauth2/v2.0/authorize`);
    expect(url.searchParams.get('client_id')).toBe(clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');

    const setCookie = res.headers?.['Set-Cookie'];
    const cookieValue = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieValue).toContain('fastgpt_sso_auth=');
  });

  it('should login with callback, create local user/team and set session cookie', async () => {
    await saveConfig();
    const authUrlRes = await getAuthUrl();
    const setCookie = authUrlRes.headers?.['Set-Cookie'];
    const cookieValue = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    const cookieToken = String(cookieValue).split(';')[0].split('=')[1];
    const cookiePayload = jwt.verify(cookieToken, process.env.ROOT_KEY as string) as {
      state: string;
      nonce: string;
    };

    const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
    const jwksUrl = 'https://example.com/jwks';
    const tokenEndpoint = 'https://example.com/token';
    const email = 'entra-user@example.com';
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    jwk.use = 'sig';
    jwk.alg = 'RS256';

    const idToken = await new SignJWT({
      email,
      preferred_username: email,
      nonce: cookiePayload.nonce
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (
          url ===
          `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`
        ) {
          return new Response(
            JSON.stringify({
              issuer,
              jwks_uri: jwksUrl,
              token_endpoint: tokenEndpoint
            }),
            { status: 200 }
          );
        }
        if (url === tokenEndpoint) {
          return new Response(
            JSON.stringify({
              id_token: idToken
            }),
            { status: 200 }
          );
        }
        if (url === jwksUrl) {
          return new Response(
            JSON.stringify({
              keys: [jwk]
            }),
            { status: 200 }
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const callbackRes = await Call<
      ssoCallbackApi.ssoCallbackBody,
      ssoCallbackApi.ssoCallbackQuery,
      ssoCallbackApi.ssoCallbackResponse
    >(ssoCallbackApi.default, {
      body: {
        code: 'entra-code',
        state: cookiePayload.state
      },
      headers: {
        cookie: cookieValue
      },
      method: 'POST'
    });

    expect(callbackRes.code).toBe(200);
    expect(callbackRes.data.user.username).toBe(email);
    expect(callbackRes.data.user.team.teamName).toBe('My Team');

    const createdUser = await MongoUser.findOne({ username: email }, '_id').lean();
    const createdTeamCount = await MongoTeamMember.countDocuments({ userId: createdUser?._id });
    expect(createdUser?._id).toBeDefined();
    expect(createdTeamCount).toBeGreaterThan(0);

    const callbackCookies = callbackRes.headers?.['Set-Cookie'];
    const cookieList = Array.isArray(callbackCookies) ? callbackCookies : [callbackCookies];
    expect(cookieList.some((item) => String(item).includes('fastgpt_token='))).toBe(true);
    expect(cookieList.some((item) => String(item).includes('fastgpt_sso_auth=;'))).toBe(true);
  });

  it('should auto-create a default team for an existing user without active team', async () => {
    await saveConfig();
    const [user] = await MongoUser.create([
      {
        username: 'existing-no-team@example.com',
        password: 'Password123!'
      }
    ]);
    const authUrlRes = await getAuthUrl();
    const setCookie = authUrlRes.headers?.['Set-Cookie'];
    const cookieValue = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    const cookieToken = String(cookieValue).split(';')[0].split('=')[1];
    const cookiePayload = jwt.verify(cookieToken, process.env.ROOT_KEY as string) as {
      state: string;
      nonce: string;
    };

    const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
    const jwksUrl = 'https://example.com/jwks-2';
    const tokenEndpoint = 'https://example.com/token-2';
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key-2';
    jwk.use = 'sig';
    jwk.alg = 'RS256';

    const idToken = await new SignJWT({
      email: user.username,
      nonce: cookiePayload.nonce
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-2' })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (
          url ===
          `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`
        ) {
          return new Response(
            JSON.stringify({
              issuer,
              jwks_uri: jwksUrl,
              token_endpoint: tokenEndpoint
            }),
            { status: 200 }
          );
        }
        if (url === tokenEndpoint) {
          return new Response(JSON.stringify({ id_token: idToken }), { status: 200 });
        }
        if (url === jwksUrl) {
          return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const callbackRes = await Call(ssoCallbackApi.default, {
      body: {
        code: 'entra-code',
        state: cookiePayload.state
      },
      headers: {
        cookie: cookieValue
      },
      method: 'POST'
    });

    expect(callbackRes.code).toBe(200);
    expect(await MongoTeamMember.countDocuments({ userId: user._id })).toBeGreaterThan(0);
  });

  it('should reject callback login for forbidden users', async () => {
    await saveConfig();
    const [user] = await MongoUser.create([
      {
        username: 'forbidden@example.com',
        password: 'Password123!',
        status: UserStatusEnum.forbidden
      }
    ]);
    expect(user.username).toBe('forbidden@example.com');

    const authUrlRes = await getAuthUrl();
    const setCookie = authUrlRes.headers?.['Set-Cookie'];
    const cookieValue = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    const cookieToken = String(cookieValue).split(';')[0].split('=')[1];
    const cookiePayload = jwt.verify(cookieToken, process.env.ROOT_KEY as string) as {
      state: string;
      nonce: string;
    };

    const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
    const jwksUrl = 'https://example.com/jwks-3';
    const tokenEndpoint = 'https://example.com/token-3';
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key-3';
    jwk.use = 'sig';
    jwk.alg = 'RS256';

    const idToken = await new SignJWT({
      email: user.username,
      nonce: cookiePayload.nonce
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-3' })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (
          url ===
          `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`
        ) {
          return new Response(
            JSON.stringify({
              issuer,
              jwks_uri: jwksUrl,
              token_endpoint: tokenEndpoint
            }),
            { status: 200 }
          );
        }
        if (url === tokenEndpoint) {
          return new Response(JSON.stringify({ id_token: idToken }), { status: 200 });
        }
        if (url === jwksUrl) {
          return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const callbackRes = await Call(ssoCallbackApi.default, {
      body: {
        code: 'entra-code',
        state: cookiePayload.state
      },
      headers: {
        cookie: cookieValue
      },
      method: 'POST'
    });

    expect(callbackRes.code).toBe(500);
    expect(callbackRes.error).toBe(UserErrEnum.unAuthSso);
  });
});
