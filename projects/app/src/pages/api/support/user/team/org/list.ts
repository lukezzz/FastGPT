import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import type { OrgListItemType } from '@fastgpt/global/support/user/team/org/type';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';
import { getOrgChildrenQueryPath } from '@fastgpt/service/support/user/team/query';

export type getOrgListQuery = {};
export type getOrgListBody = {
  orgId: string;
  withPermission?: boolean;
  searchKey?: string;
};
export type getOrgListResponse = OrgListItemType[];

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function handler(
  req: ApiRequestProps<getOrgListBody, getOrgListQuery>,
  _res: ApiResponseType<getOrgListResponse>
): Promise<getOrgListResponse> {
  const { teamId, permission } = await authUserPer({ req, authToken: true });

  const { orgId = '', withPermission = true } = req.body;
  const searchKey = req.body.searchKey?.trim();

  const filter = await (async () => {
    if (searchKey) {
      return {
        teamId,
        path: {
          $ne: ''
        },
        name: {
          $regex: new RegExp(escapeRegExp(searchKey), 'i')
        }
      };
    }

    const childPath = await getOrgChildrenQueryPath({
      teamId,
      orgId
    });

    if (!childPath) {
      return undefined;
    }

    return {
      teamId,
      path: childPath
    };
  })();

  if (!filter) {
    return [];
  }

  const orgs = await MongoOrgModel.find(
    filter,
    '_id teamId pathId path name avatar description updateTime'
  )
    .sort({ updateTime: -1 })
    .lean();

  if (orgs.length === 0) {
    return [];
  }

  const orgIdList = orgs.map((item) => item._id);
  const childPathList = orgs.map((item) => `${item.path ?? ''}/${item.pathId}`);

  const [childCounts, memberCounts] = await Promise.all([
    MongoOrgModel.aggregate<{
      _id: string;
      count: number;
    }>([
      {
        $match: {
          teamId,
          path: {
            $in: childPathList
          }
        }
      },
      {
        $group: {
          _id: '$path',
          count: {
            $sum: 1
          }
        }
      }
    ]),
    MongoOrgMemberModel.aggregate<{
      _id: string;
      count: number;
    }>([
      {
        $match: {
          teamId,
          orgId: { $in: orgIdList }
        }
      },
      {
        $group: {
          _id: '$orgId',
          count: {
            $sum: 1
          }
        }
      }
    ])
  ]);

  const childCountMap = new Map(childCounts.map((item) => [String(item._id), item.count]));
  const memberCountMap = new Map(memberCounts.map((item) => [String(item._id), item.count]));

  return orgs.map((org) => {
    const orgId = String(org._id);
    const childPath = `${org.path ?? ''}/${org.pathId}`;

    return {
      _id: orgId,
      teamId: String(org.teamId),
      pathId: org.pathId,
      path: org.path,
      name: org.name,
      avatar: org.avatar,
      description: org.description,
      updateTime: org.updateTime,
      total: (childCountMap.get(childPath) || 0) + (memberCountMap.get(orgId) || 0),
      ...(withPermission
        ? {
            permission
          }
        : {})
    } as OrgListItemType;
  });
}

export default NextAPI(handler);
