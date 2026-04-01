import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import type { PaginationResponse } from '@fastgpt/web/common/fetch/type';
import type { UserModelSchema } from '@fastgpt/global/support/user/type';

type AdminUserItem = Pick<
  UserModelSchema,
  '_id' | 'username' | 'status' | 'timezone' | 'createTime' | 'lastLoginTmbId'
>;

export type listUsersQuery = {
  pageNum?: number | string;
  pageSize?: number | string;
  searchKey?: string;
  status?: UserModelSchema['status'];
};
export type listUsersBody = {};
export type listUsersResponse = PaginationResponse<AdminUserItem>;

async function handler(
  req: ApiRequestProps<listUsersBody, listUsersQuery>,
  _res: ApiResponseType<listUsersResponse>
): Promise<listUsersResponse> {
  await authSystemAdmin({ req });

  const pageNum = Math.max(1, Number(req.query.pageNum || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
  const searchKey = req.query.searchKey?.trim();
  const status = req.query.status;

  const filter = {
    ...(searchKey
      ? {
          username: {
            $regex: new RegExp(searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
          }
        }
      : {}),
    ...(status ? { status } : {})
  };

  const [total, list] = await Promise.all([
    MongoUser.countDocuments(filter),
    MongoUser.find(filter, 'username status timezone createTime lastLoginTmbId')
      .sort({ createTime: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .lean()
  ]);

  return {
    total,
    list: list.map((item) => ({
      _id: String(item._id),
      username: item.username,
      status: item.status,
      timezone: item.timezone,
      createTime: item.createTime,
      lastLoginTmbId: item.lastLoginTmbId ? String(item.lastLoginTmbId) : undefined
    }))
  };
}

export default NextAPI(handler);
