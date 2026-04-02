import {
  TeamMemberRoleEnum,
  TeamMemberStatusEnum
} from '@fastgpt/global/support/user/team/constant';
import { MongoTeamMember } from './teamMemberSchema';
import { MongoUser } from '../schema';
import { MongoGroupMemberModel } from '../../permission/memberGroup/groupMemberSchema';
import { MongoOrgMemberModel } from '../../permission/org/orgMemberSchema';
import { MongoOrgModel } from '../../permission/org/orgSchema';
import { MongoTeam } from './teamSchema';
import { getResourcePermission } from '../../permission/controller';
import { PerResourceTypeEnum } from '@fastgpt/global/support/permission/constant';
import {
  TeamDefaultPermissionVal,
  TeamManagePermissionVal
} from '@fastgpt/global/support/permission/user/constant';
import { TeamPermission } from '@fastgpt/global/support/permission/user/controller';
import type { TeamMemberItemType } from '@fastgpt/global/support/user/team/type';

type PaginationResponse<T = {}> = {
  total: number;
  list: T[];
};

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getMemberStatusFilter = (status?: 'active' | 'inactive') => {
  if (status === 'active') {
    return {
      status: TeamMemberStatusEnum.active
    };
  }

  if (status === 'inactive') {
    return {
      status: {
        $in: [TeamMemberStatusEnum.leave, TeamMemberStatusEnum.forbidden]
      }
    };
  }

  return {};
};

const getRootOrg = async (teamId: string) => {
  return MongoOrgModel.findOne(
    {
      teamId,
      path: ''
    },
    '_id path pathId name'
  ).lean();
};

export async function buildMemberOrgsMap({ teamId, tmbIds }: { teamId: string; tmbIds: string[] }) {
  const tmbIdSet = Array.from(new Set(tmbIds.filter(Boolean)));
  if (tmbIdSet.length === 0) {
    return new Map<string, string[]>();
  }

  const orgMembers = await MongoOrgMemberModel.find(
    {
      teamId,
      tmbId: {
        $in: tmbIdSet
      }
    },
    'tmbId orgId'
  ).lean();

  if (orgMembers.length === 0) {
    return new Map<string, string[]>();
  }

  const orgIdSet = Array.from(
    new Set(orgMembers.map((item) => String(item.orgId)).filter(Boolean))
  );
  const orgs = await MongoOrgModel.find(
    {
      teamId,
      _id: {
        $in: orgIdSet
      }
    },
    '_id path pathId name'
  ).lean();

  if (orgs.length === 0) {
    return new Map<string, string[]>();
  }

  const missingParentPathIdSet = new Set<string>();
  const orgPathIdSet = new Set(orgs.map((org) => String(org.pathId)));
  orgs.forEach((org) => {
    org.path
      ?.split('/')
      .filter(Boolean)
      .forEach((pathId) => {
        if (!orgPathIdSet.has(pathId)) {
          missingParentPathIdSet.add(pathId);
        }
      });
  });

  const parentOrgs =
    missingParentPathIdSet.size > 0
      ? await MongoOrgModel.find(
          {
            teamId,
            pathId: {
              $in: Array.from(missingParentPathIdSet)
            }
          },
          'pathId name'
        ).lean()
      : [];

  const pathIdNameMap = new Map<string, string>();
  parentOrgs.forEach((org) => {
    pathIdNameMap.set(String(org.pathId), org.name);
  });
  orgs.forEach((org) => {
    pathIdNameMap.set(String(org.pathId), org.name);
  });

  const team = await MongoTeam.findById(teamId, 'name').lean();
  const teamName = team?.name || 'Team';

  const orgNameMap = new Map<string, string>();
  orgs.forEach((org) => {
    const parentNames = org.path
      ?.split('/')
      .filter(Boolean)
      .map((pathId) => pathIdNameMap.get(pathId))
      .filter((name): name is string => !!name && name !== 'ROOT');

    const fullPath = `/${teamName}${parentNames.length ? `/${parentNames.join('/')}` : ''}/${org.name}`;
    orgNameMap.set(String(org._id), fullPath);
  });

  const result = new Map<string, string[]>();
  orgMembers.forEach((orgMember) => {
    const tmbId = String(orgMember.tmbId);
    const orgPath = orgNameMap.get(String(orgMember.orgId));
    if (!orgPath) return;

    const orgList = result.get(tmbId) || [];
    if (!orgList.includes(orgPath)) {
      orgList.push(orgPath);
    }
    result.set(tmbId, orgList);
  });

  return result;
}

export async function getTeamMemberList({
  teamId,
  status,
  withPermission = true,
  withOrgs = true,
  searchKey,
  orgId,
  groupId,
  pageSize,
  offset
}: {
  teamId: string;
  status?: 'active' | 'inactive';
  withPermission?: boolean;
  withOrgs?: boolean;
  searchKey?: string;
  orgId?: string;
  groupId?: string;
  pageSize: number;
  offset: number;
}): Promise<PaginationResponse<TeamMemberItemType>> {
  const search = searchKey?.trim();

  const [orgTmbIds, groupMemberRecords] = await Promise.all([
    orgId && orgId !== ''
      ? MongoOrgMemberModel.find(
          {
            teamId,
            orgId
          },
          'tmbId'
        ).lean()
      : Promise.resolve([]),
    groupId
      ? MongoGroupMemberModel.find(
          {
            groupId
          },
          'tmbId role'
        ).lean()
      : Promise.resolve([])
  ]);

  const groupTmbIds = groupId ? groupMemberRecords.map((item) => String(item.tmbId)) : undefined;
  const orgMemberTmbIds =
    orgId && orgId !== '' ? orgTmbIds.map((item) => String(item.tmbId)) : undefined;

  const filteredTmbIdSet = (() => {
    if (!groupTmbIds && !orgMemberTmbIds) {
      return undefined;
    }

    if (groupTmbIds && orgMemberTmbIds) {
      const orgSet = new Set(orgMemberTmbIds);
      return Array.from(new Set(groupTmbIds.filter((id) => orgSet.has(id))));
    }

    return Array.from(new Set(groupTmbIds || orgMemberTmbIds || []));
  })();

  if (filteredTmbIdSet && filteredTmbIdSet.length === 0) {
    return {
      total: 0,
      list: []
    };
  }

  const userFilter = search
    ? {
        $or: [
          {
            username: {
              $regex: new RegExp(escapeRegExp(search), 'i')
            }
          },
          {
            contact: {
              $regex: new RegExp(escapeRegExp(search), 'i')
            }
          }
        ]
      }
    : undefined;

  const matchedUsers = userFilter ? await MongoUser.find(userFilter, '_id').lean() : [];
  const matchedUserIds = matchedUsers.map((item) => String(item._id));

  const memberSearchFilter = search
    ? {
        $or: [
          {
            name: {
              $regex: new RegExp(escapeRegExp(search), 'i')
            }
          },
          ...(matchedUserIds.length
            ? [
                {
                  userId: {
                    $in: matchedUserIds
                  }
                }
              ]
            : [])
        ]
      }
    : {};

  const memberFilter = {
    teamId,
    ...getMemberStatusFilter(status),
    ...(filteredTmbIdSet
      ? {
          _id: {
            $in: filteredTmbIdSet
          }
        }
      : {}),
    ...memberSearchFilter
  };

  const [total, members] = await Promise.all([
    MongoTeamMember.countDocuments(memberFilter),
    MongoTeamMember.find(memberFilter, '_id userId name avatar role status createTime updateTime')
      .sort({ createTime: 1 })
      .skip(offset)
      .limit(pageSize)
      .lean()
  ]);

  if (members.length === 0) {
    return {
      total,
      list: []
    };
  }

  const [users, orgsMap, permissionList] = await Promise.all([
    MongoUser.find(
      {
        _id: {
          $in: members.map((item) => String(item.userId))
        }
      },
      '_id username contact'
    ).lean(),
    withOrgs
      ? buildMemberOrgsMap({
          teamId,
          tmbIds: members.map((item) => String(item._id))
        })
      : Promise.resolve(new Map<string, string[]>()),
    withPermission
      ? Promise.all(
          members.map(async (member) => {
            const permission = await getResourcePermission({
              resourceType: PerResourceTypeEnum.team,
              teamId,
              tmbId: String(member._id)
            });

            return new TeamPermission({
              per: permission ?? TeamDefaultPermissionVal,
              isOwner: member.role === TeamMemberRoleEnum.owner
            });
          })
        )
      : Promise.resolve([])
  ]);

  const userMap = new Map(users.map((item) => [String(item._id), item]));
  const groupRoleMap = new Map(groupMemberRecords.map((item) => [String(item.tmbId), item.role]));

  return {
    total,
    list: members.map((member, index) => {
      const tmbId = String(member._id);
      const user = userMap.get(String(member.userId));

      return {
        userId: String(member.userId),
        tmbId,
        teamId,
        memberName: member.name || user?.username || 'Member',
        avatar: member.avatar,
        role: member.role,
        status: member.status,
        contact: user?.contact,
        createTime: member.createTime,
        updateTime: member.updateTime,
        ...(withPermission
          ? {
              permission: permissionList[index]
            }
          : {}),
        ...(withOrgs
          ? {
              orgs: orgsMap.get(tmbId)
            }
          : {}),
        ...(groupId
          ? {
              groupRole: groupRoleMap.get(tmbId)
            }
          : {})
      } as TeamMemberItemType;
    })
  };
}

export async function searchTeamMembers({
  teamId,
  searchKey,
  limit = 50
}: {
  teamId: string;
  searchKey: string;
  limit?: number;
}): Promise<Omit<TeamMemberItemType, 'teamId' | 'permission'>[]> {
  const search = searchKey.trim();
  if (!search) {
    return [];
  }

  const userFilter = {
    $or: [
      {
        username: {
          $regex: new RegExp(escapeRegExp(search), 'i')
        }
      },
      {
        contact: {
          $regex: new RegExp(escapeRegExp(search), 'i')
        }
      }
    ]
  };

  const matchedUsers = await MongoUser.find(userFilter, '_id').lean();
  const matchedUserIds = matchedUsers.map((item) => String(item._id));

  const members = await MongoTeamMember.find(
    {
      teamId,
      $or: [
        {
          name: {
            $regex: new RegExp(escapeRegExp(search), 'i')
          }
        },
        ...(matchedUserIds.length
          ? [
              {
                userId: {
                  $in: matchedUserIds
                }
              }
            ]
          : [])
      ]
    },
    '_id userId name avatar role status createTime updateTime'
  )
    .sort({ createTime: 1 })
    .limit(limit)
    .lean();

  if (members.length === 0) {
    return [];
  }

  const [users, orgsMap] = await Promise.all([
    MongoUser.find(
      {
        _id: {
          $in: members.map((item) => String(item.userId))
        }
      },
      '_id username contact'
    ).lean(),
    buildMemberOrgsMap({
      teamId,
      tmbIds: members.map((item) => String(item._id))
    })
  ]);

  const userMap = new Map(users.map((item) => [String(item._id), item]));

  return members.map((member) => {
    const tmbId = String(member._id);
    const user = userMap.get(String(member.userId));

    return {
      userId: String(member.userId),
      tmbId,
      memberName: member.name || user?.username || 'Member',
      avatar: member.avatar,
      role: member.role,
      status: member.status,
      contact: user?.contact,
      createTime: member.createTime,
      updateTime: member.updateTime,
      orgs: orgsMap.get(tmbId)
    };
  });
}

export async function getOrgChildrenQueryPath({
  teamId,
  orgId
}: {
  teamId: string;
  orgId: string;
}) {
  if (orgId === '') {
    const rootOrg = await getRootOrg(teamId);
    if (!rootOrg) {
      return undefined;
    }
    return `${rootOrg.path ?? ''}/${rootOrg.pathId}`;
  }

  const currentOrg = await MongoOrgModel.findOne(
    {
      teamId,
      _id: orgId
    },
    'path pathId'
  ).lean();

  if (!currentOrg) {
    return undefined;
  }

  return `${currentOrg.path ?? ''}/${currentOrg.pathId}`;
}

export async function getTeamPermissionByTmbId({
  teamId,
  tmbId,
  isOwner
}: {
  teamId: string;
  tmbId: string;
  isOwner?: boolean;
}) {
  const permission = await getResourcePermission({
    resourceType: PerResourceTypeEnum.team,
    teamId,
    tmbId
  });

  return new TeamPermission({
    per: permission ?? TeamDefaultPermissionVal,
    isOwner
  });
}

export function getGroupManagePermission({
  role,
  teamHasManagePermission,
  isRoot
}: {
  role?: string;
  teamHasManagePermission?: boolean;
  isRoot?: boolean;
}) {
  if (isRoot || role === 'owner') {
    return new TeamPermission({
      isOwner: true
    });
  }

  if (teamHasManagePermission || role === 'admin') {
    return new TeamPermission({
      per: TeamManagePermissionVal
    });
  }

  return new TeamPermission({
    per: TeamDefaultPermissionVal
  });
}
