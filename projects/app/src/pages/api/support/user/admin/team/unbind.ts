import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { TeamErrEnum } from '@fastgpt/global/common/error/code/team';
import {
  TeamMemberRoleEnum,
  TeamMemberStatusEnum
} from '@fastgpt/global/support/user/team/constant';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';

export type adminUnbindTeamQuery = {};
export type adminUnbindTeamBody = {
  userId: string;
  teamId: string;
};
export type adminUnbindTeamResponse = {};

async function handler(
  req: ApiRequestProps<adminUnbindTeamBody, adminUnbindTeamQuery>,
  _res: ApiResponseType<adminUnbindTeamResponse>
): Promise<adminUnbindTeamResponse> {
  await authSystemAdmin({ req });

  const params = {
    ...(req.query || {}),
    ...(req.body || {})
  } as adminUnbindTeamBody;
  const userId = params.userId?.trim();
  const teamId = params.teamId?.trim();

  if (!userId || !teamId) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const user = await MongoUser.findById(userId, '_id lastLoginTmbId').lean();
  if (!user) {
    return Promise.reject(UserErrEnum.notUser);
  }

  const tmb = await MongoTeamMember.findOne({
    userId,
    teamId
  });
  if (!tmb) {
    return Promise.reject(TeamErrEnum.unAuthTeam);
  }
  if (tmb.role === TeamMemberRoleEnum.owner) {
    return Promise.reject(TeamErrEnum.unPermission);
  }

  if (tmb.status === TeamMemberStatusEnum.active) {
    const activeMembers = await MongoTeamMember.countDocuments({
      userId,
      status: TeamMemberStatusEnum.active
    });

    if (activeMembers <= 1) {
      return Promise.reject(TeamErrEnum.unPermission);
    }

    tmb.status = TeamMemberStatusEnum.leave;
    tmb.updateTime = new Date();
    await tmb.save();
  }

  if (String(user.lastLoginTmbId) === String(tmb._id)) {
    const fallbackTmb = await MongoTeamMember.findOne(
      {
        userId,
        status: TeamMemberStatusEnum.active,
        _id: { $ne: tmb._id }
      },
      '_id'
    )
      .sort({ createTime: 1 })
      .lean();

    if (fallbackTmb) {
      await MongoUser.findByIdAndUpdate(userId, {
        lastLoginTmbId: fallbackTmb._id
      });
    }
  }

  return {};
}

export default NextAPI(handler);
