import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import type { ResLogin } from '@/global/support/api/userRes';
import { loginByEntraCallback } from '@/service/support/user/sso';

export type ssoCallbackQuery = {};
export type ssoCallbackBody = {
  code: string;
  state: string;
};
export type ssoCallbackResponse = ResLogin;

async function handler(
  req: ApiRequestProps<ssoCallbackBody, ssoCallbackQuery>,
  res: ApiResponseType<ssoCallbackResponse>
): Promise<ssoCallbackResponse> {
  if (req.method !== 'POST') {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  return loginByEntraCallback({
    req,
    res,
    code: req.body.code,
    state: req.body.state
  });
}

export default NextAPI(handler);
