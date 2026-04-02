import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import {
  PerResourceTypeEnum,
  ReadPermissionVal
} from '@fastgpt/global/support/permission/constant';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import type { CollaboratorItemType } from '@fastgpt/global/support/permission/collaborator';
import { getResourceCollaborators } from '@fastgpt/service/support/permission/collaborator';

export type getTeamCollaboratorListQuery = {};
export type getTeamCollaboratorListBody = {};
export type getTeamCollaboratorListResponse = CollaboratorItemType[];

async function handler(
  req: ApiRequestProps<getTeamCollaboratorListBody, getTeamCollaboratorListQuery>,
  _res: ApiResponseType<getTeamCollaboratorListResponse>
): Promise<getTeamCollaboratorListResponse> {
  const { teamId } = await authUserPer({
    req,
    authToken: true,
    per: ReadPermissionVal
  });

  return getResourceCollaborators({
    teamId,
    resourceType: PerResourceTypeEnum.team
  });
}

export default NextAPI(handler);
