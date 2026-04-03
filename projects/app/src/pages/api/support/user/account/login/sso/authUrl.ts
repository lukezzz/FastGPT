import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { createEntraAuthUrl } from '@/service/support/user/sso';

export type ssoAuthUrlQuery = {};
export type ssoAuthUrlBody = {
  redirectUri: string;
};
export type ssoAuthUrlResponse = string;

async function handler(
  req: ApiRequestProps<ssoAuthUrlBody, ssoAuthUrlQuery>,
  res: ApiResponseType<ssoAuthUrlResponse>
): Promise<ssoAuthUrlResponse> {
  if (req.method !== 'POST') {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  return createEntraAuthUrl({
    req,
    res,
    redirectUri: req.body.redirectUri
  });
}

export default NextAPI(handler);
