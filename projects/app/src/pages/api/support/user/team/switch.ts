import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { createUserSession } from '@fastgpt/service/support/user/session';
import { setCookie } from '@fastgpt/service/support/permission/controller';
import { TeamErrEnum } from '@fastgpt/global/common/error/code/team';
import requestIp from 'request-ip';

export type switchTeamQuery = {};
export type switchTeamBody = {
  teamId: string;
};
export type switchTeamResponse = string;

async function handler(
  req: ApiRequestProps<switchTeamBody, switchTeamQuery>,
  res: ApiResponseType<switchTeamResponse>
): Promise<switchTeamResponse> {
  const { teamId } = req.body;
  const { userId } = await authCert({ req, authToken: true });

  const tmb = await MongoTeamMember.findOne({
    userId,
    teamId,
    status: TeamMemberStatusEnum.active
  });

  if (!tmb) {
    return Promise.reject(TeamErrEnum.unAuthTeam);
  }

  await MongoUser.findByIdAndUpdate(userId, {
    lastLoginTmbId: tmb._id
  });

  const token = await createUserSession({
    userId: String(userId),
    teamId: String(tmb.teamId),
    tmbId: String(tmb._id),
    ip: requestIp.getClientIp(req)
  });
  setCookie(res as any, token);

  return token;
}

export default NextAPI(handler);
