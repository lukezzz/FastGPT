import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { TeamErrEnum } from '@fastgpt/global/common/error/code/team';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';

export type adminSetDefaultTeamQuery = {};
export type adminSetDefaultTeamBody = {
  userId: string;
  teamId: string;
};
export type adminSetDefaultTeamResponse = {};

async function handler(
  req: ApiRequestProps<adminSetDefaultTeamBody, adminSetDefaultTeamQuery>,
  _res: ApiResponseType<adminSetDefaultTeamResponse>
): Promise<adminSetDefaultTeamResponse> {
  await authSystemAdmin({ req });

  const userId = req.body.userId?.trim();
  const teamId = req.body.teamId?.trim();

  if (!userId || !teamId) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const user = await MongoUser.findById(userId, '_id').lean();
  if (!user) {
    return Promise.reject(UserErrEnum.notUser);
  }

  const tmb = await MongoTeamMember.findOne(
    {
      userId,
      teamId,
      status: TeamMemberStatusEnum.active
    },
    '_id'
  ).lean();
  if (!tmb) {
    return Promise.reject(TeamErrEnum.unAuthTeam);
  }

  await MongoUser.findByIdAndUpdate(userId, {
    lastLoginTmbId: tmb._id
  });

  return {};
}

export default NextAPI(handler);
