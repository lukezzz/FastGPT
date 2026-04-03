import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { TeamMemberRoleEnum } from '@fastgpt/global/support/user/team/constant';
import type { TeamMemberSchema } from '@fastgpt/global/support/user/team/type';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';

export type adminUserTeamsQuery = {
  userId: string;
};
export type adminUserTeamsBody = {};
export type adminUserTeamsItem = {
  teamId: string;
  teamName: string;
  tmbId: string;
  status: TeamMemberSchema['status'];
  isDefault: boolean;
  isOwner: boolean;
  ownerUserId?: string;
  ownerUsername?: string;
};
export type adminUserTeamsResponse = adminUserTeamsItem[];

async function handler(
  req: ApiRequestProps<adminUserTeamsBody, adminUserTeamsQuery>,
  _res: ApiResponseType<adminUserTeamsResponse>
): Promise<adminUserTeamsResponse> {
  await authSystemAdmin({ req });

  const userId = req.query.userId?.trim();
  if (!userId) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const user = await MongoUser.findById(userId, '_id lastLoginTmbId').lean();
  if (!user) {
    return Promise.reject(UserErrEnum.notUser);
  }

  const members = await MongoTeamMember.find({ userId }, '_id teamId status role createTime')
    .sort({ createTime: 1 })
    .lean();

  const teamIdSet = new Set(members.map((item) => String(item.teamId)));
  const teams = await MongoTeam.find(
    { _id: { $in: Array.from(teamIdSet) } },
    '_id name ownerId'
  ).lean();
  const ownerIdSet = new Set(teams.map((item) => String(item.ownerId)).filter(Boolean));
  const owners = await MongoUser.find(
    { _id: { $in: Array.from(ownerIdSet) } },
    '_id username'
  ).lean();
  const teamMap = new Map(teams.map((item) => [String(item._id), item]));
  const ownerMap = new Map(owners.map((item) => [String(item._id), item.username]));

  const result: adminUserTeamsResponse = [];

  for (const member of members) {
    const team = teamMap.get(String(member.teamId));
    if (!team) continue;

    const ownerUserId = team.ownerId ? String(team.ownerId) : undefined;

    result.push({
      teamId: String(team._id),
      teamName: team.name,
      tmbId: String(member._id),
      status: member.status as TeamMemberSchema['status'],
      isDefault: String(user.lastLoginTmbId) === String(member._id),
      isOwner: member.role === TeamMemberRoleEnum.owner,
      ownerUserId,
      ownerUsername: ownerUserId ? ownerMap.get(ownerUserId) : undefined
    });
  }

  return result;
}

export default NextAPI(handler);
