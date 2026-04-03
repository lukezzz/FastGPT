import { type UserType } from '@fastgpt/global/support/user/type';
import { MongoUser } from './schema';
import { getTmbInfoByTmbId, getUserDefaultTeam } from './team/controller';
import { ERROR_ENUM } from '@fastgpt/global/common/error/errorCode';
import { MongoTeamMember } from './team/teamMemberSchema';
import { TeamErrEnum } from '@fastgpt/global/common/error/code/team';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import type { TeamTmbItemType } from '@fastgpt/global/support/user/team/type';

export async function authUserExist({ userId, username }: { userId?: string; username?: string }) {
  if (userId) {
    return MongoUser.findOne({ _id: userId });
  }
  if (username) {
    return MongoUser.findOne({ username });
  }
  return null;
}

const isUsableTeamMemberStatus = (status: string) =>
  status !== TeamMemberStatusEnum.leave && status !== TeamMemberStatusEnum.forbidden;

export async function getUserLoginTeam({
  userId,
  preferredTmbId
}: {
  userId: string;
  preferredTmbId?: string;
}): Promise<TeamTmbItemType> {
  if (preferredTmbId) {
    try {
      const preferredTmb = await getTmbInfoByTmbId({ tmbId: preferredTmbId });
      if (
        String(preferredTmb.userId) === String(userId) &&
        isUsableTeamMemberStatus(preferredTmb.status)
      ) {
        return preferredTmb;
      }
    } catch (error) {}
  }

  const fallbackTmb = await MongoTeamMember.findOne(
    {
      userId,
      status: TeamMemberStatusEnum.active
    },
    '_id'
  )
    .sort({ createTime: 1 })
    .lean();

  if (!fallbackTmb?._id) {
    return Promise.reject(TeamErrEnum.unAuthTeam);
  }

  return getTmbInfoByTmbId({ tmbId: String(fallbackTmb._id) });
}

export async function getUserDetail({
  tmbId,
  userId
}: {
  tmbId?: string;
  userId?: string;
}): Promise<UserType> {
  const tmb = await (async () => {
    if (tmbId) {
      try {
        const result = await getTmbInfoByTmbId({ tmbId });
        return result;
      } catch (error) {}
    }
    if (userId) {
      return getUserDefaultTeam({ userId });
    }
    return Promise.reject(ERROR_ENUM.unAuthorization);
  })();
  const user = await MongoUser.findById(tmb.userId);

  if (!user) {
    return Promise.reject(ERROR_ENUM.unAuthorization);
  }

  return {
    _id: user._id,
    username: user.username,
    avatar: tmb.avatar,
    timezone: user.timezone,
    promotionRate: user.promotionRate,
    team: tmb,
    notificationAccount: tmb.notificationAccount,
    permission: tmb.permission,
    contact: user.contact
  };
}
