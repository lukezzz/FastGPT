import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import {
  ManagePermissionVal,
  PerResourceTypeEnum
} from '@fastgpt/global/support/permission/constant';
import { authApp } from '@fastgpt/service/support/permission/app/auth';
import type { UpdateAppCollaboratorBody } from '@fastgpt/global/core/app/collaborator';
import { upsertResourceCollaborators } from '@fastgpt/service/support/permission/collaborator';
import { MongoApp } from '@fastgpt/service/core/app/schema';

export type postUpdateAppCollaboratorQuery = {};
export type postUpdateAppCollaboratorBody = UpdateAppCollaboratorBody;
export type postUpdateAppCollaboratorResponse = {};

async function handler(
  req: ApiRequestProps<postUpdateAppCollaboratorBody, postUpdateAppCollaboratorQuery>,
  _res: ApiResponseType<postUpdateAppCollaboratorResponse>
): Promise<postUpdateAppCollaboratorResponse> {
  const appId = req.body.appId?.trim();

  const { teamId, app } = await authApp({
    req,
    authToken: true,
    appId,
    per: ManagePermissionVal
  });

  await upsertResourceCollaborators({
    teamId,
    resourceType: PerResourceTypeEnum.app,
    resourceId: appId,
    members: req.body.members,
    groups: req.body.groups,
    orgs: req.body.orgs,
    permission: req.body.permission
  });

  if (app.parentId && app.inheritPermission) {
    await MongoApp.findByIdAndUpdate(appId, {
      inheritPermission: false
    });
  }

  return {};
}

export default NextAPI(handler);
