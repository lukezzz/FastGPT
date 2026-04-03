import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { getUserTeamList } from '@fastgpt/service/support/user/team/controller';
import type { TeamTmbItemType, TeamMemberSchema } from '@fastgpt/global/support/user/team/type';

export type getTeamListQuery = {
  status?: `${TeamMemberSchema['status']}`;
};
export type getTeamListBody = {};
export type getTeamListResponse = TeamTmbItemType[];

async function handler(
  req: ApiRequestProps<getTeamListBody, getTeamListQuery>,
  _res: ApiResponseType<getTeamListResponse>
): Promise<getTeamListResponse> {
  const { userId } = await authCert({ req, authToken: true });
  return getUserTeamList({ userId, status: req.query.status });
}

export default NextAPI(handler);
