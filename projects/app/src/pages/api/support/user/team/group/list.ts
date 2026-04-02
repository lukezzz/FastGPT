import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import type { GetGroupListBody } from '@fastgpt/global/support/permission/memberGroup/api';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import type { MemberGroupListItemType } from '@fastgpt/global/support/permission/memberGroup/type';
import { GroupMemberRole } from '@fastgpt/global/support/permission/memberGroup/constant';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { getGroupManagePermission } from '@fastgpt/service/support/user/team/query';

export type getGroupListQuery = {};
export type getGroupListResponse<T extends boolean = boolean> = MemberGroupListItemType<T>[];

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const roleOrderMap: Record<string, number> = {
  [GroupMemberRole.owner]: 0,
  [GroupMemberRole.admin]: 1,
  [GroupMemberRole.member]: 2
};

async function handler(
  req: ApiRequestProps<GetGroupListBody, getGroupListQuery>,
  _res: ApiResponseType<getGroupListResponse>
): Promise<getGroupListResponse> {
  const { teamId, tmbId, permission, isRoot } = await authUserPer({ req, authToken: true });

  const withMembers = !!req.body.withMembers;
  const searchKey = req.body.searchKey?.trim();

  const filter = {
    teamId,
    ...(searchKey
      ? {
          name: {
            $regex: new RegExp(escapeRegExp(searchKey), 'i')
          }
        }
      : {})
  };

  const groups = await MongoMemberGroupModel.find(filter, '_id teamId name avatar updateTime')
    .sort({ updateTime: -1 })
    .lean();

  if (groups.length === 0) {
    return [];
  }

  if (!withMembers) {
    return groups.map((group) => ({
      _id: String(group._id),
      teamId: String(group.teamId),
      name: group.name,
      avatar: group.avatar,
      updateTime: group.updateTime,
      members: undefined,
      count: undefined,
      owner: undefined,
      permission: undefined
    })) as getGroupListResponse;
  }

  const groupIdList = groups.map((group) => String(group._id));
  const groupMembers = await MongoGroupMemberModel.find(
    {
      groupId: {
        $in: groupIdList
      }
    },
    'groupId tmbId role'
  ).lean();

  const tmbIdSet = Array.from(new Set(groupMembers.map((item) => String(item.tmbId))));
  const teamMembers =
    tmbIdSet.length > 0
      ? await MongoTeamMember.find(
          {
            _id: {
              $in: tmbIdSet
            },
            teamId
          },
          '_id name avatar'
        ).lean()
      : [];

  const teamMemberMap = new Map(teamMembers.map((item) => [String(item._id), item]));
  const groupMembersMap = new Map<string, typeof groupMembers>();
  groupMembers.forEach((item) => {
    const groupId = String(item.groupId);
    const list = groupMembersMap.get(groupId) || [];
    list.push(item);
    groupMembersMap.set(groupId, list);
  });

  return groups.map((group) => {
    const groupId = String(group._id);
    const members: { tmbId: string; name: string; avatar: string; role: `${GroupMemberRole}` }[] = (
      groupMembersMap.get(groupId) || []
    )
      .flatMap((item) => {
        const member = teamMemberMap.get(String(item.tmbId));
        if (!member) return [];

        return [
          {
            tmbId: String(item.tmbId),
            name: member.name,
            avatar: member.avatar,
            role: item.role as `${GroupMemberRole}`
          }
        ];
      })
      .sort((a, b) => (roleOrderMap[a.role] || 99) - (roleOrderMap[b.role] || 99));

    const owner = members.find((item) => item.role === GroupMemberRole.owner);
    const currentUserRole = members.find((item) => item.tmbId === String(tmbId))?.role;

    return {
      _id: groupId,
      teamId: String(group.teamId),
      name: group.name,
      avatar: group.avatar,
      updateTime: group.updateTime,
      members: members.map((item) => ({
        tmbId: item.tmbId,
        name: item.name,
        avatar: item.avatar
      })),
      count: members.length,
      owner: owner
        ? {
            tmbId: owner.tmbId,
            name: owner.name,
            avatar: owner.avatar
          }
        : undefined,
      permission: getGroupManagePermission({
        role: currentUserRole,
        teamHasManagePermission: permission.hasManagePer,
        isRoot
      })
    };
  }) as getGroupListResponse;
}

export default NextAPI(handler);
