import type {
  CollaboratorItemType,
  UpdateClbPermissionProps
} from '@fastgpt/global/support/permission/collaborator';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { TeamErrEnum } from '@fastgpt/global/common/error/code/team';
import { Permission } from '@fastgpt/global/support/permission/controller';
import { type PerResourceTypeEnum } from '@fastgpt/global/support/permission/constant';
import type { PermissionValueType } from '@fastgpt/global/support/permission/type';
import { MongoResourcePermission } from './schema';
import { getClbsAndGroupsWithInfo } from './controller';
import { MongoTeamMember } from '../user/team/teamMemberSchema';
import { MongoMemberGroupModel } from './memberGroup/memberGroupSchema';
import { MongoOrgModel } from './org/orgSchema';

type DeleteTargetQuery = {
  tmbId?: string;
  groupId?: string;
  orgId?: string;
};

const uniqueIds = (ids: string[] = []) =>
  Array.from(new Set(ids.map((id) => id?.trim()).filter(Boolean)));

export async function getResourceCollaborators({
  teamId,
  resourceType,
  resourceId
}: {
  teamId: string;
  resourceType: `${PerResourceTypeEnum}`;
  resourceId?: string;
}): Promise<CollaboratorItemType[]> {
  const [tmbClbs, groupClbs, orgClbs] = await getClbsAndGroupsWithInfo(
    resourceType === 'team'
      ? {
          teamId,
          resourceType: 'team'
        }
      : {
          teamId,
          resourceType,
          resourceId: resourceId || ''
        }
  );

  const memberCollaborators: CollaboratorItemType[] = tmbClbs.flatMap((item) => {
    if (!item.tmb) return [];

    return [
      {
        teamId: String(item.teamId),
        tmbId: String(item.tmbId),
        name: item.tmb.name,
        avatar: item.tmb.avatar,
        permission: new Permission({ per: item.permission })
      }
    ];
  });

  const groupCollaborators: CollaboratorItemType[] = groupClbs.flatMap((item) => {
    if (!item.group) return [];

    return [
      {
        teamId: String(item.teamId),
        groupId: String(item.groupId),
        name: item.group.name,
        avatar: item.group.avatar,
        permission: new Permission({ per: item.permission })
      }
    ];
  });

  const orgCollaborators: CollaboratorItemType[] = orgClbs.flatMap((item) => {
    if (!item.org) return [];

    return [
      {
        teamId: String(item.teamId),
        orgId: String(item.orgId),
        name: item.org.name,
        avatar: item.org.avatar,
        permission: new Permission({ per: item.permission })
      }
    ];
  });

  return [...memberCollaborators, ...groupCollaborators, ...orgCollaborators];
}

async function ensureCollaboratorIdsValid({
  teamId,
  members,
  groups,
  orgs
}: {
  teamId: string;
  members?: string[];
  groups?: string[];
  orgs?: string[];
}) {
  const memberIds = uniqueIds(members);
  const groupIds = uniqueIds(groups);
  const orgIds = uniqueIds(orgs);

  const [memberCount, groupCount, orgCount] = await Promise.all([
    memberIds.length > 0
      ? MongoTeamMember.countDocuments({
          teamId,
          _id: {
            $in: memberIds
          }
        })
      : Promise.resolve(0),
    groupIds.length > 0
      ? MongoMemberGroupModel.countDocuments({
          teamId,
          _id: {
            $in: groupIds
          }
        })
      : Promise.resolve(0),
    orgIds.length > 0
      ? MongoOrgModel.countDocuments({
          teamId,
          _id: {
            $in: orgIds
          }
        })
      : Promise.resolve(0)
  ]);

  if (
    memberCount !== memberIds.length ||
    groupCount !== groupIds.length ||
    orgCount !== orgIds.length
  ) {
    return Promise.reject(TeamErrEnum.unAuthTeam);
  }

  return {
    memberIds,
    groupIds,
    orgIds
  };
}

export async function upsertResourceCollaborators({
  teamId,
  resourceType,
  resourceId,
  members,
  groups,
  orgs,
  permission
}: {
  teamId: string;
  resourceType: `${PerResourceTypeEnum}`;
  resourceId?: string;
} & UpdateClbPermissionProps) {
  if (typeof permission !== 'number' || Number.isNaN(permission)) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const { memberIds, groupIds, orgIds } = await ensureCollaboratorIdsValid({
    teamId,
    members,
    groups,
    orgs
  });

  if (memberIds.length === 0 && groupIds.length === 0 && orgIds.length === 0) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const baseSet = {
    teamId,
    resourceType,
    ...(resourceType === 'team' ? {} : { resourceId }),
    permission: permission as PermissionValueType
  };

  const operations = [
    ...memberIds.map((tmbId) => ({
      updateOne: {
        filter: {
          teamId,
          resourceType,
          ...(resourceType === 'team' ? {} : { resourceId }),
          tmbId
        },
        update: {
          $set: {
            ...baseSet,
            tmbId
          },
          $unset: {
            groupId: 1,
            orgId: 1
          }
        },
        upsert: true
      }
    })),
    ...groupIds.map((groupId) => ({
      updateOne: {
        filter: {
          teamId,
          resourceType,
          ...(resourceType === 'team' ? {} : { resourceId }),
          groupId
        },
        update: {
          $set: {
            ...baseSet,
            groupId
          },
          $unset: {
            tmbId: 1,
            orgId: 1
          }
        },
        upsert: true
      }
    })),
    ...orgIds.map((orgId) => ({
      updateOne: {
        filter: {
          teamId,
          resourceType,
          ...(resourceType === 'team' ? {} : { resourceId }),
          orgId
        },
        update: {
          $set: {
            ...baseSet,
            orgId
          },
          $unset: {
            tmbId: 1,
            groupId: 1
          }
        },
        upsert: true
      }
    }))
  ];

  if (operations.length > 0) {
    await MongoResourcePermission.bulkWrite(operations, {
      ordered: false
    });
  }
}

export async function deleteResourceCollaborator({
  teamId,
  resourceType,
  resourceId,
  tmbId,
  groupId,
  orgId
}: {
  teamId: string;
  resourceType: `${PerResourceTypeEnum}`;
  resourceId?: string;
} & DeleteTargetQuery) {
  const targetCount = [tmbId, groupId, orgId].filter(Boolean).length;
  if (targetCount !== 1) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const { memberIds, groupIds, orgIds } = await ensureCollaboratorIdsValid({
    teamId,
    members: tmbId ? [tmbId] : undefined,
    groups: groupId ? [groupId] : undefined,
    orgs: orgId ? [orgId] : undefined
  });

  await MongoResourcePermission.deleteOne({
    teamId,
    resourceType,
    ...(resourceType === 'team' ? {} : { resourceId }),
    ...(memberIds[0] ? { tmbId: memberIds[0] } : {}),
    ...(groupIds[0] ? { groupId: groupIds[0] } : {}),
    ...(orgIds[0] ? { orgId: orgIds[0] } : {})
  });
}
