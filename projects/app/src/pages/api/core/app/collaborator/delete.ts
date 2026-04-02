import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import {
  ManagePermissionVal,
  PerResourceTypeEnum
} from '@fastgpt/global/support/permission/constant';
import { authApp } from '@fastgpt/service/support/permission/app/auth';
import type { AppCollaboratorDeleteParams } from '@fastgpt/global/core/app/collaborator';
import { deleteResourceCollaborator } from '@fastgpt/service/support/permission/collaborator';
import { MongoApp } from '@fastgpt/service/core/app/schema';

export type deleteAppCollaboratorQuery = AppCollaboratorDeleteParams;
export type deleteAppCollaboratorBody = AppCollaboratorDeleteParams;
export type deleteAppCollaboratorResponse = {};

async function handler(
  req: ApiRequestProps<deleteAppCollaboratorBody, deleteAppCollaboratorQuery>,
  _res: ApiResponseType<deleteAppCollaboratorResponse>
): Promise<deleteAppCollaboratorResponse> {
  const params = {
    ...(req.query || {}),
    ...(req.body || {})
  } as AppCollaboratorDeleteParams;

  const appId = params.appId?.trim();

  const { teamId, app } = await authApp({
    req,
    authToken: true,
    appId,
    per: ManagePermissionVal
  });

  await deleteResourceCollaborator({
    teamId,
    resourceType: PerResourceTypeEnum.app,
    resourceId: appId,
    tmbId: params.tmbId,
    groupId: params.groupId,
    orgId: params.orgId
  });

  if (app.parentId && app.inheritPermission) {
    await MongoApp.findByIdAndUpdate(appId, {
      inheritPermission: false
    });
  }

  return {};
}

export default NextAPI(handler);
