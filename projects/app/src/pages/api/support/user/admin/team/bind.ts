import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { TeamErrEnum } from '@fastgpt/global/common/error/code/team';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';

export type adminBindTeamQuery = {};
export type adminBindTeamBody = {
  userId: string;
  teamId: string;
};
export type adminBindTeamResponse = {
  tmbId: string;
};

async function handler(
  req: ApiRequestProps<adminBindTeamBody, adminBindTeamQuery>,
  _res: ApiResponseType<adminBindTeamResponse>
): Promise<adminBindTeamResponse> {
  await authSystemAdmin({ req });

  const userId = req.body.userId?.trim();
  const teamId = req.body.teamId?.trim();

  if (!userId || !teamId) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const [user, team] = await Promise.all([
    MongoUser.findById(userId, '_id username lastLoginTmbId').lean(),
    MongoTeam.findById(teamId, '_id').lean()
  ]);
  if (!user) {
    return Promise.reject(UserErrEnum.notUser);
  }
  if (!team) {
    return Promise.reject(TeamErrEnum.unAuthTeam);
  }

  const existedTmb = await MongoTeamMember.findOne({
    userId,
    teamId
  });

  const tmb = await (async () => {
    if (!existedTmb) {
      const [createdTmb] = await MongoTeamMember.create([
        {
          teamId,
          userId,
          name: user.username,
          status: TeamMemberStatusEnum.active,
          createTime: new Date()
        }
      ]);
      return createdTmb;
    }

    if (existedTmb.status !== TeamMemberStatusEnum.active) {
      existedTmb.status = TeamMemberStatusEnum.active;
      existedTmb.updateTime = new Date();
      await existedTmb.save();
    }

    return existedTmb;
  })();

  if (!user.lastLoginTmbId) {
    await MongoUser.findByIdAndUpdate(userId, { lastLoginTmbId: tmb._id });
  }

  return {
    tmbId: String(tmb._id)
  };
}

export default NextAPI(handler);
