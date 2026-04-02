import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import type { PaginationResponse } from '@fastgpt/web/common/fetch/type';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { Types } from '@fastgpt/service/common/mongo';

export type adminTeamListQuery = {
  pageNum?: number | string;
  pageSize?: number | string;
  searchKey?: string;
};
export type adminTeamListBody = {};
export type AdminTeamListItem = {
  teamId: string;
  teamName: string;
  ownerUserId?: string;
  ownerUsername?: string;
  createTime: Date;
  activeMemberCount: number;
};
export type adminTeamListResponse = PaginationResponse<AdminTeamListItem>;

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function handler(
  req: ApiRequestProps<adminTeamListBody, adminTeamListQuery>,
  _res: ApiResponseType<adminTeamListResponse>
): Promise<adminTeamListResponse> {
  await authSystemAdmin({ req });

  const pageNum = Math.max(1, Number(req.query.pageNum || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
  const searchKey = req.query.searchKey?.trim();

  const filter = searchKey
    ? {
        name: {
          $regex: new RegExp(escapeRegExp(searchKey), 'i')
        }
      }
    : {};

  const [total, teams] = await Promise.all([
    MongoTeam.countDocuments(filter),
    MongoTeam.find(filter, '_id name ownerId createTime')
      .sort({ createTime: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .lean()
  ]);

  const teamIdList = teams.map((item) => String(item._id));
  const ownerIdSet = new Set(teams.map((item) => String(item.ownerId)).filter(Boolean));
  const owners = await MongoUser.find(
    { _id: { $in: Array.from(ownerIdSet) } },
    '_id username'
  ).lean();
  const ownerMap = new Map(owners.map((item) => [String(item._id), item.username]));
  const activeCounts = teamIdList.length
    ? await MongoTeamMember.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            teamId: { $in: teamIdList.map((id) => new Types.ObjectId(id)) },
            status: TeamMemberStatusEnum.active
          }
        },
        {
          $group: {
            _id: '$teamId',
            count: { $sum: 1 }
          }
        }
      ])
    : [];
  const activeCountMap = new Map(activeCounts.map((item) => [String(item._id), item.count]));

  return {
    total,
    list: teams.map((team) => ({
      teamId: String(team._id),
      teamName: team.name,
      ownerUserId: team.ownerId ? String(team.ownerId) : undefined,
      ownerUsername: team.ownerId ? ownerMap.get(String(team.ownerId)) : undefined,
      createTime: team.createTime,
      activeMemberCount: activeCountMap.get(String(team._id)) || 0
    }))
  };
}

export default NextAPI(handler);
