import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import {
  ReadPermissionVal,
  PerResourceTypeEnum
} from '@fastgpt/global/support/permission/constant';
import { authApp } from '@fastgpt/service/support/permission/app/auth';
import type { CollaboratorItemType } from '@fastgpt/global/support/permission/collaborator';
import { getResourceCollaborators } from '@fastgpt/service/support/permission/collaborator';

export type getAppCollaboratorListQuery = {
  appId: string;
};
export type getAppCollaboratorListBody = {};
export type getAppCollaboratorListResponse = CollaboratorItemType[];

async function handler(
  req: ApiRequestProps<getAppCollaboratorListBody, getAppCollaboratorListQuery>,
  _res: ApiResponseType<getAppCollaboratorListResponse>
): Promise<getAppCollaboratorListResponse> {
  const appId = req.query.appId?.trim();

  const { teamId } = await authApp({
    req,
    authToken: true,
    appId,
    per: ReadPermissionVal
  });

  return getResourceCollaborators({
    teamId,
    resourceType: PerResourceTypeEnum.app,
    resourceId: appId
  });
}

export default NextAPI(handler);
