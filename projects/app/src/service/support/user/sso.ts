import type { ApiRequestProps } from '@fastgpt/service/type/next';
import type { NextApiResponse } from 'next';
import Cookie from 'cookie';
import jwt from 'jsonwebtoken';
import requestIp from 'request-ip';
import { createHash, randomBytes } from 'crypto';
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet, type JWTPayload } from 'jose';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { UserStatusEnum, OAuthEnum } from '@fastgpt/global/support/user/constant';
import type {
  EntraSSOPrivateConfigType,
  FastGPTConfigFileType
} from '@fastgpt/global/common/system/types';
import { DEFAULT_TEAM_AVATAR } from '@fastgpt/global/common/system/constants';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { createDefaultTeam } from '@fastgpt/service/support/user/team/controller';
import { createUserSession } from '@fastgpt/service/support/user/session';
import { setCookie, appendSetCookie } from '@fastgpt/service/support/permission/controller';
import { getUserDetail, getUserLoginTeam } from '@fastgpt/service/support/user/controller';
import type { ResLogin } from '@/global/support/api/userRes';
import {
  getFastGPTConfigFromDB,
  updateFastGPTConfigBuffer,
  upsertFastGPTConfig
} from '@fastgpt/service/common/system/config/controller';
import { initSystemConfig } from '@/service/common/system';
import { pushTrack } from '@fastgpt/service/common/middle/tracks/utils';
import { addOperationLog } from '@fastgpt/service/support/operationLog/addOperationLog';
import { OperationLogEventEnum } from '@fastgpt/global/support/operationLog/constants';

const EntraScope = 'openid profile email';
const DefaultEntraTitle = 'Microsoft Entra ID';
const SSOAuthCookieName = 'fastgpt_sso_auth';
const SSOCookieMaxAge = 10 * 60;
const MaskedClientSecret = '********';

type EntraSSOAuthCookiePayload = {
  state: string;
  nonce: string;
  redirectUri: string;
  codeVerifier: string;
};

type EntraDiscoveryResponse = {
  issuer: string;
  jwks_uri: string;
  token_endpoint: string;
};

type EntraTokenResponse = {
  id_token?: string;
};

type EntraJwksResponse = JSONWebKeySet;

export type AdminEntraSSOConfigType = {
  enabled: boolean;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  title: string;
};

export const getMaskedClientSecret = () => MaskedClientSecret;

const getSSOCookieSecret = () => {
  const secret = process.env.ROOT_KEY || process.env.FILE_TOKEN_KEY;
  if (!secret) {
    throw new Error('SSO cookie secret is not configured');
  }
  return secret;
};

const toBase64Url = (buffer: Buffer) =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const generateCodeVerifier = () => toBase64Url(randomBytes(32));

const createCodeChallenge = (codeVerifier: string) =>
  toBase64Url(createHash('sha256').update(codeVerifier).digest());

const getEntraAuthorizeUrl = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;

const getEntraDiscoveryUrl = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`;

const isEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

const getLoginEmail = (payload: JWTPayload) => {
  const email = typeof payload.email === 'string' ? payload.email : '';
  if (email && isEmail(email)) return email.trim().toLowerCase();

  const preferredUsername =
    typeof payload.preferred_username === 'string' ? payload.preferred_username : '';
  if (preferredUsername && isEmail(preferredUsername)) {
    return preferredUsername.trim().toLowerCase();
  }

  return '';
};

const getEntraSSOConfig = (): EntraSSOPrivateConfigType | undefined => {
  return global.authConfigs?.sso?.entra;
};

const assertEnabledEntraConfig = () => {
  const config = getEntraSSOConfig();
  if (!config?.enabled) {
    throw new Error('SSO is disabled');
  }
  if (!config.tenantId || !config.clientId || !config.clientSecret) {
    throw new Error('SSO config is incomplete');
  }

  return config;
};

const setSSOAuthCookie = (
  res: NextApiResponse,
  payload: EntraSSOAuthCookiePayload,
  maxAge: number = SSOCookieMaxAge
) => {
  const token = jwt.sign(payload, getSSOCookieSecret(), {
    expiresIn: maxAge
  });
  appendSetCookie(
    res,
    `${SSOAuthCookieName}=${token}; Path=/; HttpOnly; Max-Age=${maxAge}; SameSite=Lax;`
  );
};

export const clearSSOAuthCookie = (res: NextApiResponse) => {
  appendSetCookie(res, `${SSOAuthCookieName}=; Path=/; Max-Age=0; SameSite=Lax;`);
};

const getSSOAuthCookiePayload = (req: ApiRequestProps): EntraSSOAuthCookiePayload => {
  const cookies = Cookie.parse(req.headers.cookie || '');
  const authToken = cookies[SSOAuthCookieName];

  if (!authToken) {
    throw new Error('SSO auth cookie is missing');
  }

  const payload = jwt.verify(authToken, getSSOCookieSecret()) as EntraSSOAuthCookiePayload;
  if (!payload.state || !payload.nonce || !payload.redirectUri || !payload.codeVerifier) {
    throw new Error('SSO auth cookie is invalid');
  }

  return payload;
};

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error =
      json?.error_description ||
      json?.error?.message ||
      json?.error ||
      json?.message ||
      response.statusText;
    return Promise.reject(error || 'Request failed');
  }

  return json as T;
};

const getEntraDiscovery = async (tenantId: string) => {
  return requestJson<EntraDiscoveryResponse>(getEntraDiscoveryUrl(tenantId));
};

const exchangeEntraCode = async ({
  discovery,
  config,
  code,
  redirectUri,
  codeVerifier
}: {
  discovery: EntraDiscoveryResponse;
  config: Required<Pick<EntraSSOPrivateConfigType, 'clientId' | 'clientSecret'>>;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}) => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
    scope: EntraScope,
    code_verifier: codeVerifier
  });

  return requestJson<EntraTokenResponse>(discovery.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
};

const getEntraJwks = async (jwksUrl: string) => {
  return requestJson<EntraJwksResponse>(jwksUrl);
};

const getOrCreateSsoLoginResult = async (
  email: string,
  req: ApiRequestProps,
  res: NextApiResponse
) => {
  const existingUser = await MongoUser.findOne(
    { username: email },
    '_id status lastLoginTmbId username'
  ).lean();

  if (existingUser?.status === UserStatusEnum.forbidden) {
    return Promise.reject(UserErrEnum.unAuthSso);
  }

  const loginContext = await (async () => {
    if (!existingUser?._id) {
      return mongoSessionRun(async (session) => {
        const [createdUser] = await MongoUser.create(
          [
            {
              username: email,
              password: randomBytes(32).toString('hex'),
              passwordUpdateTime: new Date()
            }
          ],
          { session, ordered: true }
        );

        const tmb = await createDefaultTeam({
          userId: String(createdUser._id),
          teamName: 'My Team',
          memberName: email,
          avatar: DEFAULT_TEAM_AVATAR,
          session
        });

        if (!tmb) {
          return Promise.reject('Create default team failed');
        }

        await MongoUser.findByIdAndUpdate(
          createdUser._id,
          {
            lastLoginTmbId: tmb._id
          },
          { session }
        );

        return {
          userId: String(createdUser._id),
          tmbId: String(tmb._id),
          teamId: String(tmb.teamId)
        };
      });
    }

    const userId = String(existingUser._id);
    try {
      const loginTeam = await getUserLoginTeam({
        userId,
        preferredTmbId: existingUser.lastLoginTmbId
          ? String(existingUser.lastLoginTmbId)
          : undefined
      });

      if (!existingUser.lastLoginTmbId || String(existingUser.lastLoginTmbId) !== loginTeam.tmbId) {
        await MongoUser.findByIdAndUpdate(existingUser._id, {
          lastLoginTmbId: loginTeam.tmbId
        });
      }

      return {
        userId,
        tmbId: loginTeam.tmbId,
        teamId: loginTeam.teamId
      };
    } catch (error) {
      return mongoSessionRun(async (session) => {
        const tmb = await createDefaultTeam({
          userId,
          teamName: 'My Team',
          memberName: email,
          avatar: DEFAULT_TEAM_AVATAR,
          session
        });

        if (!tmb) {
          return Promise.reject(error);
        }

        await MongoUser.findByIdAndUpdate(
          existingUser._id,
          {
            lastLoginTmbId: tmb._id
          },
          { session }
        );

        return {
          userId,
          tmbId: String(tmb._id),
          teamId: String(tmb.teamId)
        };
      });
    }
  })();

  const user = await getUserDetail({
    tmbId: loginContext.tmbId
  });
  const token = await createUserSession({
    userId: loginContext.userId,
    teamId: loginContext.teamId,
    tmbId: loginContext.tmbId,
    ip: requestIp.getClientIp(req)
  });

  setCookie(res, token);
  pushTrack.login({
    type: OAuthEnum.sso,
    uid: loginContext.userId,
    teamId: loginContext.teamId,
    tmbId: loginContext.tmbId
  });
  addOperationLog({
    tmbId: loginContext.tmbId,
    teamId: loginContext.teamId,
    event: OperationLogEventEnum.LOGIN
  });

  return {
    user,
    token
  } satisfies ResLogin;
};

export const getAdminEntraSSOConfig = (): AdminEntraSSOConfigType => {
  const config = getEntraSSOConfig();

  return {
    enabled: !!config?.enabled,
    tenantId: config?.tenantId || '',
    clientId: config?.clientId || '',
    clientSecret: config?.clientSecret ? MaskedClientSecret : '',
    title: config?.title || DefaultEntraTitle
  };
};

export const saveAdminEntraSSOConfig = async (
  data: Pick<
    AdminEntraSSOConfigType,
    'enabled' | 'tenantId' | 'clientId' | 'clientSecret' | 'title'
  >
) => {
  const tenantId = data.tenantId.trim();
  const clientId = data.clientId.trim();
  const title = data.title.trim() || DefaultEntraTitle;
  const currentConfig = getEntraSSOConfig();
  const clientSecret =
    data.clientSecret === MaskedClientSecret
      ? currentConfig?.clientSecret || ''
      : data.clientSecret.trim();

  if (data.enabled && (!tenantId || !clientId || !clientSecret)) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const { fastgptConfig } = await getFastGPTConfigFromDB();
  const nextConfig: FastGPTConfigFileType = {
    feConfigs: fastgptConfig.feConfigs || {},
    systemEnv: fastgptConfig.systemEnv || ({} as FastGPTConfigFileType['systemEnv']),
    authConfigs: {
      ...fastgptConfig.authConfigs,
      sso: {
        ...fastgptConfig.authConfigs?.sso,
        entra: {
          enabled: data.enabled,
          tenantId,
          clientId,
          clientSecret,
          title
        }
      }
    },
    subPlans: fastgptConfig.subPlans
  };

  await upsertFastGPTConfig(nextConfig);
  await initSystemConfig();
  await updateFastGPTConfigBuffer();

  return getAdminEntraSSOConfig();
};

export const createEntraAuthUrl = async ({
  req,
  res,
  redirectUri
}: {
  req: ApiRequestProps;
  res: NextApiResponse;
  redirectUri: string;
}) => {
  const config = assertEnabledEntraConfig();

  if (!redirectUri) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const state = randomBytes(16).toString('hex');
  const nonce = randomBytes(16).toString('hex');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);

  setSSOAuthCookie(res, {
    state,
    nonce,
    redirectUri,
    codeVerifier
  });

  const url = new URL(getEntraAuthorizeUrl(config.tenantId!));
  url.searchParams.set('client_id', config.clientId!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', EntraScope);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return url.toString();
};

export const loginByEntraCallback = async ({
  req,
  res,
  code,
  state
}: {
  req: ApiRequestProps;
  res: NextApiResponse;
  code: string;
  state: string;
}) => {
  if (!code || !state) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  try {
    const cookiePayload = getSSOAuthCookiePayload(req);
    if (cookiePayload.state !== state) {
      return Promise.reject('SSO state mismatch');
    }

    const config = assertEnabledEntraConfig();
    const discovery = await getEntraDiscovery(config.tenantId!);
    const tokenRes = await exchangeEntraCode({
      discovery,
      config: {
        clientId: config.clientId!,
        clientSecret: config.clientSecret!
      },
      code,
      redirectUri: cookiePayload.redirectUri,
      codeVerifier: cookiePayload.codeVerifier
    });

    if (!tokenRes.id_token) {
      return Promise.reject('SSO id token is missing');
    }

    const jwks = createLocalJWKSet(await getEntraJwks(discovery.jwks_uri));
    const { payload } = await jwtVerify(tokenRes.id_token, jwks, {
      issuer: discovery.issuer,
      audience: config.clientId!
    });

    if (payload.nonce !== cookiePayload.nonce) {
      return Promise.reject('SSO nonce mismatch');
    }

    const email = getLoginEmail(payload);
    if (!email) {
      return Promise.reject('Unable to resolve email from id token');
    }

    return getOrCreateSsoLoginResult(email, req, res);
  } finally {
    clearSSOAuthCookie(res);
  }
};
