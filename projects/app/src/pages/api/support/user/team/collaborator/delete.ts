import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import {
  ManagePermissionVal,
  PerResourceTypeEnum
} from '@fastgpt/global/support/permission/constant';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import type { DeletePermissionQuery } from '@fastgpt/global/support/permission/collaborator';
import { deleteResourceCollaborator } from '@fastgpt/service/support/permission/collaborator';

export type deleteTeamCollaboratorQuery = DeletePermissionQuery;
export type deleteTeamCollaboratorBody = DeletePermissionQuery;
export type deleteTeamCollaboratorResponse = {};

async function handler(
  req: ApiRequestProps<deleteTeamCollaboratorBody, deleteTeamCollaboratorQuery>,
  _res: ApiResponseType<deleteTeamCollaboratorResponse>
): Promise<deleteTeamCollaboratorResponse> {
  const { teamId } = await authUserPer({
    req,
    authToken: true,
    per: ManagePermissionVal
  });

  const params = {
    ...(req.query || {}),
    ...(req.body || {})
  } as DeletePermissionQuery;

  await deleteResourceCollaborator({
    teamId,
    resourceType: PerResourceTypeEnum.team,
    tmbId: params.tmbId,
    groupId: params.groupId,
    orgId: params.orgId
  });

  return {};
}

export default NextAPI(handler);
