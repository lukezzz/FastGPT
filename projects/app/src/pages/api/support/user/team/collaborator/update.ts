import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import {
  ManagePermissionVal,
  PerResourceTypeEnum
} from '@fastgpt/global/support/permission/constant';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import type { UpdateClbPermissionProps } from '@fastgpt/global/support/permission/collaborator';
import { upsertResourceCollaborators } from '@fastgpt/service/support/permission/collaborator';

export type putTeamCollaboratorUpdateQuery = {};
export type putTeamCollaboratorUpdateBody = UpdateClbPermissionProps;
export type putTeamCollaboratorUpdateResponse = {};

async function handler(
  req: ApiRequestProps<putTeamCollaboratorUpdateBody, putTeamCollaboratorUpdateQuery>,
  _res: ApiResponseType<putTeamCollaboratorUpdateResponse>
): Promise<putTeamCollaboratorUpdateResponse> {
  const { teamId } = await authUserPer({
    req,
    authToken: true,
    per: ManagePermissionVal
  });

  await upsertResourceCollaborators({
    teamId,
    resourceType: PerResourceTypeEnum.team,
    members: req.body.members,
    groups: req.body.groups,
    orgs: req.body.orgs,
    permission: req.body.permission
  });

  return {};
}

export default NextAPI(handler);
