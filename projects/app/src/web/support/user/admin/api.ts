import { DELETE, GET, POST, PUT } from '@/web/common/api/request';
import type { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import type { PaginationResponse } from '@fastgpt/web/common/fetch/type';

export type AdminUserItem = {
  _id: string;
  username: string;
  status: `${UserStatusEnum}`;
  timezone: string;
  createTime: number;
  lastLoginTmbId?: string;
};

export const getAdminUserList = (params: {
  pageNum?: number;
  pageSize?: number;
  searchKey?: string;
  status?: `${UserStatusEnum}`;
}) =>
  GET<PaginationResponse<AdminUserItem>>('/support/user/admin/list', params, { maxQuantity: 1 });

export const postAdminCreateUser = (data: {
  username: string;
  password: string;
  teamName?: string;
}) => POST<{ userId: string }>('/support/user/admin/create', data);

export const putAdminUpdateUser = (data: {
  userId: string;
  timezone?: string;
  status?: `${UserStatusEnum}`;
}) => PUT('/support/user/admin/update', data);

export const delAdminUser = (userId: string) => DELETE('/support/user/admin/delete', { userId });
