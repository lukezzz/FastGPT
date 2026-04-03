import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import {
  type AdminEntraSSOConfigType,
  getAdminEntraSSOConfig,
  saveAdminEntraSSOConfig
} from '@/service/support/user/sso';

export type adminGetSSOConfigQuery = {};
export type adminGetSSOConfigBody = Partial<AdminEntraSSOConfigType>;
export type adminGetSSOConfigResponse = AdminEntraSSOConfigType;

async function handler(
  req: ApiRequestProps<adminGetSSOConfigBody, adminGetSSOConfigQuery>,
  _res: ApiResponseType<adminGetSSOConfigResponse>
): Promise<adminGetSSOConfigResponse> {
  await authSystemAdmin({ req });

  if (req.method === 'GET') {
    return getAdminEntraSSOConfig();
  }

  if (req.method === 'PUT') {
    const {
      enabled = false,
      tenantId = '',
      clientId = '',
      clientSecret = '',
      title = ''
    } = req.body || {};

    return saveAdminEntraSSOConfig({
      enabled,
      tenantId,
      clientId,
      clientSecret,
      title
    });
  }

  return Promise.reject(CommonErrEnum.invalidParams);
}

export default NextAPI(handler);
