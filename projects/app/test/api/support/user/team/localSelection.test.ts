import * as memberListApi from '@/pages/api/support/user/team/member/list';
import * as orgListApi from '@/pages/api/support/user/team/org/list';
import * as groupListApi from '@/pages/api/support/user/team/group/list';
import * as searchApi from '@/pages/api/support/user/search';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import type { GetGroupListBody } from '@fastgpt/global/support/permission/memberGroup/api';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { GroupMemberRole } from '@fastgpt/global/support/permission/memberGroup/constant';
import { getRootUser } from '@test/datas/users';
import { Call } from '@test/utils/request';
import { describe, expect, it } from 'vitest';

describe('local collaborator selection api', () => {
  it('member/list supports status, org/group filters and returns permission/org fields', async () => {
    const root = await getRootUser();

    const [activeUser, inactiveUser] = await Promise.all([
      MongoUser.create({ username: 'local_member_active', password: '123456' }),
      MongoUser.create({ username: 'local_member_inactive', password: '123456' })
    ]);

    const [activeTmb, inactiveTmb] = await MongoTeamMember.create([
      {
        teamId: root.teamId,
        userId: activeUser._id,
        name: 'local_member_active',
        status: TeamMemberStatusEnum.active
      },
      {
        teamId: root.teamId,
        userId: inactiveUser._id,
        name: 'local_member_inactive',
        status: TeamMemberStatusEnum.leave
      }
    ]);

    const rootOrg = await MongoOrgModel.create({
      teamId: root.teamId,
      name: 'ROOT',
      path: ''
    });
    const childOrg = await MongoOrgModel.create({
      teamId: root.teamId,
      name: 'R&D',
      path: `${rootOrg.path}/${rootOrg.pathId}`
    });

    await MongoOrgMemberModel.create({
      teamId: root.teamId,
      orgId: childOrg._id,
      tmbId: activeTmb._id
    });

    const group = await MongoMemberGroupModel.create({
      teamId: root.teamId,
      name: 'Collab Group'
    });
    await MongoGroupMemberModel.create([
      {
        groupId: group._id,
        tmbId: root.tmbId,
        role: GroupMemberRole.owner
      },
      {
        groupId: group._id,
        tmbId: activeTmb._id,
        role: GroupMemberRole.admin
      }
    ]);

    const activeRes = await Call<
      memberListApi.getTeamMemberListBody,
      memberListApi.getTeamMemberListQuery,
      memberListApi.getTeamMemberListResponse
    >(memberListApi.default, {
      auth: root,
      body: {
        pageSize: 20,
        offset: 0,
        status: 'active',
        searchKey: 'local_member_active',
        withPermission: true,
        withOrgs: true
      }
    });

    expect(activeRes.code).toBe(200);
    expect(activeRes.data.total).toBe(1);
    expect(activeRes.data.list[0].tmbId).toBe(String(activeTmb._id));
    expect(activeRes.data.list[0].permission).toBeDefined();
    expect(Array.isArray(activeRes.data.list[0].orgs)).toBe(true);
    expect(activeRes.data.list[0].orgs?.[0]).toContain('R&D');

    const inactiveRes = await Call<
      memberListApi.getTeamMemberListBody,
      memberListApi.getTeamMemberListQuery,
      memberListApi.getTeamMemberListResponse
    >(memberListApi.default, {
      auth: root,
      body: {
        pageSize: 20,
        offset: 0,
        status: 'inactive',
        searchKey: 'local_member_inactive'
      }
    });

    expect(inactiveRes.code).toBe(200);
    expect(inactiveRes.data.total).toBe(1);
    expect(inactiveRes.data.list[0].tmbId).toBe(String(inactiveTmb._id));

    const groupRes = await Call<
      memberListApi.getTeamMemberListBody,
      memberListApi.getTeamMemberListQuery,
      memberListApi.getTeamMemberListResponse
    >(memberListApi.default, {
      auth: root,
      body: {
        pageSize: 20,
        offset: 0,
        groupId: String(group._id),
        searchKey: 'local_member_active'
      }
    });

    expect(groupRes.code).toBe(200);
    expect(groupRes.data.total).toBe(1);
    expect(groupRes.data.list[0].groupRole).toBe(GroupMemberRole.admin);
  });

  it('org/list supports root children and search with total counter', async () => {
    const root = await getRootUser();

    const user = await MongoUser.create({ username: 'local_org_user', password: '123456' });
    const tmb = await MongoTeamMember.create({
      teamId: root.teamId,
      userId: user._id,
      name: 'local_org_user',
      status: TeamMemberStatusEnum.active
    });

    const rootOrg = await MongoOrgModel.create({
      teamId: root.teamId,
      name: 'ROOT',
      path: ''
    });
    const parentOrg = await MongoOrgModel.create({
      teamId: root.teamId,
      name: 'Platform',
      path: `${rootOrg.path}/${rootOrg.pathId}`
    });
    await MongoOrgModel.create({
      teamId: root.teamId,
      name: 'Platform-Child',
      path: `${parentOrg.path}/${parentOrg.pathId}`
    });

    await MongoOrgMemberModel.create({
      teamId: root.teamId,
      orgId: parentOrg._id,
      tmbId: tmb._id
    });

    const listRes = await Call<
      orgListApi.getOrgListBody,
      orgListApi.getOrgListQuery,
      orgListApi.getOrgListResponse
    >(orgListApi.default, {
      auth: root,
      body: {
        orgId: ''
      }
    });

    expect(listRes.code).toBe(200);
    const platform = listRes.data.find((item) => item.name === 'Platform');
    expect(platform?._id).toBeDefined();
    expect(platform?.total).toBe(2);
    expect(platform?.permission).toBeDefined();

    const searchRes = await Call<
      orgListApi.getOrgListBody,
      orgListApi.getOrgListQuery,
      orgListApi.getOrgListResponse
    >(orgListApi.default, {
      auth: root,
      body: {
        orgId: '',
        searchKey: 'Platform-Child',
        withPermission: false
      }
    });

    expect(searchRes.code).toBe(200);
    expect(searchRes.data.length).toBe(1);
    expect(searchRes.data[0].name).toBe('Platform-Child');
    expect(searchRes.data[0].permission).toBeUndefined();
  });

  it('group/list supports withMembers true and false shapes', async () => {
    const root = await getRootUser();

    const user = await MongoUser.create({ username: 'local_group_admin', password: '123456' });
    const tmb = await MongoTeamMember.create({
      teamId: root.teamId,
      userId: user._id,
      name: 'local_group_admin',
      status: TeamMemberStatusEnum.active
    });

    const group = await MongoMemberGroupModel.create({
      teamId: root.teamId,
      name: 'Core Group'
    });

    await MongoGroupMemberModel.create([
      {
        groupId: group._id,
        tmbId: root.tmbId,
        role: GroupMemberRole.owner
      },
      {
        groupId: group._id,
        tmbId: tmb._id,
        role: GroupMemberRole.admin
      }
    ]);

    const withMembersRes = await Call<
      GetGroupListBody,
      groupListApi.getGroupListQuery,
      groupListApi.getGroupListResponse
    >(groupListApi.default, {
      auth: root,
      body: {
        withMembers: true,
        searchKey: 'Core Group'
      }
    });

    expect(withMembersRes.code).toBe(200);
    expect(withMembersRes.data.length).toBe(1);
    expect(withMembersRes.data[0].count).toBe(2);
    expect(withMembersRes.data[0].owner?.tmbId).toBe(String(root.tmbId));
    expect(withMembersRes.data[0].permission?.isOwner).toBe(true);

    const noMembersRes = await Call<
      GetGroupListBody,
      groupListApi.getGroupListQuery,
      groupListApi.getGroupListResponse
    >(groupListApi.default, {
      auth: root,
      body: {
        withMembers: false,
        searchKey: 'Core Group'
      }
    });

    expect(noMembersRes.code).toBe(200);
    expect(noMembersRes.data.length).toBe(1);
    expect(noMembersRes.data[0].members).toBeUndefined();
    expect(noMembersRes.data[0].permission).toBeUndefined();
  });

  it('user/search returns team-scoped members/orgs/groups and supports switches', async () => {
    const root = await getRootUser();

    const user = await MongoUser.create({ username: 'searchable_user', password: '123456' });
    const tmb = await MongoTeamMember.create({
      teamId: root.teamId,
      userId: user._id,
      name: 'searchable_user',
      status: TeamMemberStatusEnum.active
    });

    const rootOrg = await MongoOrgModel.create({
      teamId: root.teamId,
      name: 'ROOT',
      path: ''
    });
    const org = await MongoOrgModel.create({
      teamId: root.teamId,
      name: 'SearchableOrg',
      path: `${rootOrg.path}/${rootOrg.pathId}`
    });
    await MongoOrgMemberModel.create({
      teamId: root.teamId,
      orgId: org._id,
      tmbId: tmb._id
    });

    await MongoMemberGroupModel.create({
      teamId: root.teamId,
      name: 'SearchableGroup'
    });

    const allRes = await Call<
      searchApi.getSearchBody,
      searchApi.getSearchQuery,
      searchApi.getSearchResponse
    >(searchApi.default, {
      auth: root,
      query: {
        searchKey: 'searchable'
      }
    });

    expect(allRes.code).toBe(200);
    expect(allRes.data.members.find((item) => item.tmbId === String(tmb._id))).toBeDefined();
    expect(allRes.data.orgs.find((item) => item.name === 'SearchableOrg')).toBeDefined();
    expect(allRes.data.groups.find((item) => item.name === 'SearchableGroup')).toBeDefined();

    const orgOnlyRes = await Call<
      searchApi.getSearchBody,
      searchApi.getSearchQuery,
      searchApi.getSearchResponse
    >(searchApi.default, {
      auth: root,
      query: {
        searchKey: 'searchable',
        members: 'false',
        orgs: 'true',
        groups: 'false'
      }
    });

    expect(orgOnlyRes.code).toBe(200);
    expect(orgOnlyRes.data.members.length).toBe(0);
    expect(orgOnlyRes.data.groups.length).toBe(0);
    expect(orgOnlyRes.data.orgs.length).toBeGreaterThanOrEqual(1);
  });
});
