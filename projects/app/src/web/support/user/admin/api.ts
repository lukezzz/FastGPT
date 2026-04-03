import { DELETE, GET, POST, PUT } from '@/web/common/api/request';
import type { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import type { PaginationResponse } from '@fastgpt/web/common/fetch/type';
import type { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';

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

export const postAdminCreateUser = (data: { username: string; password: string }) =>
  POST<{ userId: string }>('/support/user/admin/create', data);

export const putAdminUpdateUser = (data: {
  userId: string;
  timezone?: string;
  status?: `${UserStatusEnum}`;
}) => PUT('/support/user/admin/update', data);

export const delAdminUser = (userId: string) => DELETE('/support/user/admin/delete', { userId });

export type AdminTeamItem = {
  teamId: string;
  teamName: string;
  ownerUserId?: string;
  ownerUsername?: string;
  createTime: string;
  activeMemberCount: number;
};
export const getAdminTeamList = (params?: {
  pageNum?: number;
  pageSize?: number;
  searchKey?: string;
}) => GET<PaginationResponse<AdminTeamItem>>('/support/user/admin/team/list', params || {});

export type AdminUserTeamItem = {
  teamId: string;
  teamName: string;
  tmbId: string;
  status: `${TeamMemberStatusEnum}` | string;
  isDefault: boolean;
  isOwner: boolean;
  ownerUserId?: string;
  ownerUsername?: string;
};
export const getAdminUserTeams = (userId: string) =>
  GET<AdminUserTeamItem[]>('/support/user/admin/team/userTeams', { userId }, { maxQuantity: 1 });

export const postAdminCreateTeam = (data: { ownerUserId: string; name: string }) =>
  POST<{ teamId: string; tmbId: string }>('/support/user/admin/team/create', data);

export const postAdminBindUserTeam = (data: { userId: string; teamId: string }) =>
  POST<{ tmbId: string }>('/support/user/admin/team/bind', data);

export const putAdminSetDefaultTeam = (data: { userId: string; teamId: string }) =>
  PUT('/support/user/admin/team/default', data);

export const delAdminUnbindUserTeam = (data: { userId: string; teamId: string }) =>
  DELETE('/support/user/admin/team/unbind', data);

export const postAdminResetPassword = (data: { userId: string; newPassword: string }) =>
  POST('/support/user/admin/resetPassword', data);

export const delAdminDeleteTeam = (data: { teamId: string }) =>
  DELETE('/support/user/admin/team/delete', data);

export type AdminSSOConfig = {
  enabled: boolean;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  title: string;
};

export const getAdminSSOConfig = () =>
  GET<AdminSSOConfig>('/support/user/admin/sso/config', {}, { maxQuantity: 1 });

export const putAdminSSOConfig = (data: AdminSSOConfig) =>
  PUT<AdminSSOConfig>('/support/user/admin/sso/config', data);
