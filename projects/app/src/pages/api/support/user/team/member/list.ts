import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { parsePaginationRequest } from '@fastgpt/service/common/api/pagination';
import type { PaginationProps, PaginationResponse } from '@fastgpt/web/common/fetch/type';
import type { TeamMemberItemType } from '@fastgpt/global/support/user/team/type';
import { getTeamMemberList } from '@fastgpt/service/support/user/team/query';

export type getTeamMemberListQuery = {};
export type getTeamMemberListBody = PaginationProps<{
  status?: 'active' | 'inactive';
  withOrgs?: boolean;
  withPermission?: boolean;
  searchKey?: string;
  orgId?: string;
  groupId?: string;
}>;
export type getTeamMemberListResponse = PaginationResponse<TeamMemberItemType>;

async function handler(
  req: ApiRequestProps<getTeamMemberListBody, getTeamMemberListQuery>,
  _res: ApiResponseType<getTeamMemberListResponse>
): Promise<getTeamMemberListResponse> {
  const { teamId } = await authUserPer({ req, authToken: true });
  const { pageSize, offset } = parsePaginationRequest(req);

  const { status, withOrgs = true, withPermission = true, searchKey, orgId, groupId } = req.body;

  return getTeamMemberList({
    teamId,
    pageSize,
    offset,
    status,
    withOrgs,
    withPermission,
    searchKey,
    orgId,
    groupId
  });
}

export default NextAPI(handler);
