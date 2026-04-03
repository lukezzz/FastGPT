import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import type { SearchResult } from '@fastgpt/global/support/user/api.d';
import { searchTeamMembers } from '@fastgpt/service/support/user/team/query';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';

export type getSearchQuery = {
  searchKey: string;
  members?: boolean | string;
  orgs?: boolean | string;
  groups?: boolean | string;
};
export type getSearchBody = {};
export type getSearchResponse = SearchResult;

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const parseBool = (value: boolean | string | undefined, defaultVal = true) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return defaultVal;
};

async function handler(
  req: ApiRequestProps<getSearchBody, getSearchQuery>,
  _res: ApiResponseType<getSearchResponse>
): Promise<getSearchResponse> {
  const { teamId } = await authUserPer({ req, authToken: true });

  const searchKey = req.query.searchKey?.trim() || '';
  const withMembers = parseBool(req.query.members, true);
  const withOrgs = parseBool(req.query.orgs, true);
  const withGroups = parseBool(req.query.groups, true);

  if (!searchKey) {
    return {
      members: [],
      orgs: [],
      groups: []
    };
  }

  const searchRegex = new RegExp(escapeRegExp(searchKey), 'i');

  const [members, orgs, groups] = await Promise.all([
    withMembers
      ? searchTeamMembers({
          teamId,
          searchKey,
          limit: 100
        })
      : Promise.resolve([]),
    withOrgs
      ? (async () => {
          const orgs = await MongoOrgModel.find(
            {
              teamId,
              path: {
                $ne: ''
              },
              name: {
                $regex: searchRegex
              }
            },
            '_id teamId pathId path name avatar description updateTime'
          )
            .sort({ updateTime: -1 })
            .limit(100)
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
          const memberCountMap = new Map(
            memberCounts.map((item) => [String(item._id), item.count])
          );

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
              total: (childCountMap.get(childPath) || 0) + (memberCountMap.get(orgId) || 0)
            };
          });
        })()
      : Promise.resolve([]),
    withGroups
      ? MongoMemberGroupModel.find(
          {
            teamId,
            name: {
              $regex: searchRegex
            }
          },
          '_id teamId name avatar updateTime'
        )
          .sort({ updateTime: -1 })
          .limit(100)
          .lean()
          .then((groups) =>
            groups.map((group) => ({
              _id: String(group._id),
              teamId: String(group.teamId),
              name: group.name,
              avatar: group.avatar,
              updateTime: group.updateTime
            }))
          )
      : Promise.resolve([])
  ]);

  return {
    members,
    orgs,
    groups
  };
}

export default NextAPI(handler);
