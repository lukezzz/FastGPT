import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { TeamErrEnum } from '@fastgpt/global/common/error/code/team';

export type adminDeleteTeamQuery = {};
export type adminDeleteTeamBody = {
  teamId: string;
};
export type adminDeleteTeamResponse = {};

async function handler(
  req: ApiRequestProps<adminDeleteTeamBody, adminDeleteTeamQuery>,
  _res: ApiResponseType<adminDeleteTeamResponse>
): Promise<adminDeleteTeamResponse> {
  await authSystemAdmin({ req });

  const params = {
    ...(req.query || {}),
    ...(req.body || {})
  } as adminDeleteTeamBody;

  const teamId = params.teamId?.trim();
  if (!teamId) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const team = await MongoTeam.findById(teamId, '_id').lean();
  if (!team) {
    return Promise.reject(TeamErrEnum.unAuthTeam);
  }

  const teamMembers = await MongoTeamMember.find({ teamId }, '_id userId status').lean();

  if (teamMembers.length > 0) {
    await MongoTeamMember.updateMany(
      { teamId },
      {
        status: TeamMemberStatusEnum.forbidden,
        updateTime: new Date()
      }
    );

    const userIdSet = new Set(teamMembers.map((item) => String(item.userId)));
    for (const userId of userIdSet) {
      const user = await MongoUser.findById(userId, '_id lastLoginTmbId').lean();
      if (!user?.lastLoginTmbId) continue;

      const isLastLoginInTeam = teamMembers.some(
        (member) => String(member._id) === String(user.lastLoginTmbId)
      );
      if (!isLastLoginInTeam) continue;

      const fallbackTmb = await MongoTeamMember.findOne(
        {
          userId,
          status: TeamMemberStatusEnum.active,
          teamId: { $ne: teamId }
        },
        '_id'
      )
        .sort({ createTime: 1 })
        .lean();

      if (fallbackTmb?._id) {
        await MongoUser.findByIdAndUpdate(userId, {
          lastLoginTmbId: fallbackTmb._id
        });
      } else {
        await MongoUser.findByIdAndUpdate(userId, {
          $unset: { lastLoginTmbId: 1 }
        });
      }
    }
  }

  return {};
}

export default NextAPI(handler);
