import * as adminCreateUserApi from '@/pages/api/support/user/admin/create';
import * as adminCreateTeamApi from '@/pages/api/support/user/admin/team/create';
import * as adminBindTeamApi from '@/pages/api/support/user/admin/team/bind';
import * as adminSetDefaultTeamApi from '@/pages/api/support/user/admin/team/default';
import * as adminUnbindTeamApi from '@/pages/api/support/user/admin/team/unbind';
import * as adminResetPasswordApi from '@/pages/api/support/user/admin/resetPassword';
import { TeamErrEnum } from '@fastgpt/global/common/error/code/team';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { getUserLoginTeam } from '@fastgpt/service/support/user/controller';
import { Types } from '@fastgpt/service/common/mongo';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { getRootUser } from '@test/datas/users';
import { Call } from '@test/utils/request';
import { describe, expect, it } from 'vitest';

describe('admin user and team management api', () => {
  it('should create local user without creating default team', async () => {
    const root = await getRootUser();

    const res = await Call<
      adminCreateUserApi.adminCreateUserBody,
      adminCreateUserApi.adminCreateUserQuery,
      adminCreateUserApi.adminCreateUserResponse
    >(adminCreateUserApi.default, {
      auth: root,
      body: {
        username: 'user_without_team',
        password: 'Password123!'
      }
    });

    expect(res.code).toBe(200);
    expect(res.error).toBeUndefined();
    expect(res.data.userId).toBeDefined();

    const [user, memberCount] = await Promise.all([
      MongoUser.findById(res.data.userId, '_id lastLoginTmbId').lean(),
      MongoTeamMember.countDocuments({ userId: res.data.userId })
    ]);

    expect(user?._id).toBeDefined();
    expect(user?.lastLoginTmbId).toBeFalsy();
    expect(memberCount).toBe(0);
  });

  it('should support create team, bind, set default and unbind with constraints', async () => {
    const root = await getRootUser();

    const createUserRes = await Call<
      adminCreateUserApi.adminCreateUserBody,
      adminCreateUserApi.adminCreateUserQuery,
      adminCreateUserApi.adminCreateUserResponse
    >(adminCreateUserApi.default, {
      auth: root,
      body: {
        username: 'team_flow_user',
        password: 'Password123!'
      }
    });
    expect(createUserRes.code).toBe(200);
    const userId = createUserRes.data.userId;

    const createOwnerTeamRes = await Call<
      adminCreateTeamApi.adminCreateTeamBody,
      adminCreateTeamApi.adminCreateTeamQuery,
      adminCreateTeamApi.adminCreateTeamResponse
    >(adminCreateTeamApi.default, {
      auth: root,
      body: {
        ownerUserId: userId,
        name: 'owner-team'
      }
    });
    expect(createOwnerTeamRes.code).toBe(200);
    const ownerTeamId = createOwnerTeamRes.data.teamId;
    const ownerTmbId = createOwnerTeamRes.data.tmbId;

    const ownerTmb = await MongoTeamMember.findById(ownerTmbId).lean();
    expect(ownerTmb?.role).toBe('owner');
    expect(ownerTmb?.status).toBe(TeamMemberStatusEnum.active);

    const userAfterCreateOwnerTeam = await MongoUser.findById(userId, '_id lastLoginTmbId').lean();
    expect(String(userAfterCreateOwnerTeam?.lastLoginTmbId)).toBe(ownerTmbId);

    const createSecondTeamRes = await Call<
      adminCreateTeamApi.adminCreateTeamBody,
      adminCreateTeamApi.adminCreateTeamQuery,
      adminCreateTeamApi.adminCreateTeamResponse
    >(adminCreateTeamApi.default, {
      auth: root,
      body: {
        ownerUserId: root.userId,
        name: 'shared-team'
      }
    });
    expect(createSecondTeamRes.code).toBe(200);
    const secondTeamId = createSecondTeamRes.data.teamId;

    const bindRes = await Call<
      adminBindTeamApi.adminBindTeamBody,
      adminBindTeamApi.adminBindTeamQuery,
      adminBindTeamApi.adminBindTeamResponse
    >(adminBindTeamApi.default, {
      auth: root,
      body: {
        userId,
        teamId: secondTeamId
      }
    });
    expect(bindRes.code).toBe(200);
    expect(bindRes.data.tmbId).toBeDefined();

    const setDefaultRes = await Call<
      adminSetDefaultTeamApi.adminSetDefaultTeamBody,
      adminSetDefaultTeamApi.adminSetDefaultTeamQuery,
      adminSetDefaultTeamApi.adminSetDefaultTeamResponse
    >(adminSetDefaultTeamApi.default, {
      auth: root,
      body: {
        userId,
        teamId: secondTeamId
      }
    });
    expect(setDefaultRes.code).toBe(200);

    const userAfterSetDefault = await MongoUser.findById(userId, '_id lastLoginTmbId').lean();
    expect(String(userAfterSetDefault?.lastLoginTmbId)).toBe(bindRes.data.tmbId);

    const unbindSecondTeamRes = await Call<
      adminUnbindTeamApi.adminUnbindTeamBody,
      adminUnbindTeamApi.adminUnbindTeamQuery,
      adminUnbindTeamApi.adminUnbindTeamResponse
    >(adminUnbindTeamApi.default, {
      auth: root,
      body: {
        userId,
        teamId: secondTeamId
      }
    });
    expect(unbindSecondTeamRes.code).toBe(200);

    const [secondTmb, userAfterUnbind] = await Promise.all([
      MongoTeamMember.findById(bindRes.data.tmbId).lean(),
      MongoUser.findById(userId, '_id lastLoginTmbId').lean()
    ]);
    expect(secondTmb?.status).toBe(TeamMemberStatusEnum.leave);
    expect(String(userAfterUnbind?.lastLoginTmbId)).toBe(ownerTmbId);

    const unbindOwnerRes = await Call<
      adminUnbindTeamApi.adminUnbindTeamBody,
      adminUnbindTeamApi.adminUnbindTeamQuery,
      adminUnbindTeamApi.adminUnbindTeamResponse
    >(adminUnbindTeamApi.default, {
      auth: root,
      body: {
        userId,
        teamId: ownerTeamId
      }
    });
    expect(unbindOwnerRes.code).toBe(500);
    expect(unbindOwnerRes.error).toBe(TeamErrEnum.unPermission);
  });

  it('should reset password and fallback login team selection correctly', async () => {
    const root = await getRootUser();

    const createUserRes = await Call<
      adminCreateUserApi.adminCreateUserBody,
      adminCreateUserApi.adminCreateUserQuery,
      adminCreateUserApi.adminCreateUserResponse
    >(adminCreateUserApi.default, {
      auth: root,
      body: {
        username: 'reset_password_user',
        password: 'Password123!'
      }
    });
    expect(createUserRes.code).toBe(200);
    const userId = createUserRes.data.userId;

    const createTeamRes = await Call<
      adminCreateTeamApi.adminCreateTeamBody,
      adminCreateTeamApi.adminCreateTeamQuery,
      adminCreateTeamApi.adminCreateTeamResponse
    >(adminCreateTeamApi.default, {
      auth: root,
      body: {
        ownerUserId: userId,
        name: 'reset-password-team'
      }
    });
    expect(createTeamRes.code).toBe(200);

    const userBeforeReset = await MongoUser.findById(userId, '_id passwordUpdateTime').lean();
    const resetRes = await Call<
      adminResetPasswordApi.adminResetPasswordBody,
      adminResetPasswordApi.adminResetPasswordQuery,
      adminResetPasswordApi.adminResetPasswordResponse
    >(adminResetPasswordApi.default, {
      auth: root,
      body: {
        userId,
        newPassword: 'NewPassword123!'
      }
    });
    expect(resetRes.code).toBe(200);

    const userAfterReset = await MongoUser.findById(userId, '_id passwordUpdateTime').lean();
    expect(userAfterReset?.passwordUpdateTime).toBeDefined();
    expect(new Date(String(userAfterReset?.passwordUpdateTime)).getTime()).toBeGreaterThanOrEqual(
      new Date(String(userBeforeReset?.passwordUpdateTime)).getTime()
    );

    await MongoTeamMember.findByIdAndUpdate(createTeamRes.data.tmbId, {
      status: TeamMemberStatusEnum.forbidden
    });

    await expect(
      getUserLoginTeam({
        userId,
        preferredTmbId: new Types.ObjectId().toString()
      })
    ).rejects.toBe(TeamErrEnum.unAuthTeam);

    const team = await MongoTeam.create({
      name: 'fallback-team',
      ownerId: root.userId
    });
    const [activeMember] = await MongoTeamMember.create([
      {
        teamId: team._id,
        userId,
        status: TeamMemberStatusEnum.active
      }
    ]);

    const fallbackTeam = await getUserLoginTeam({
      userId,
      preferredTmbId: new Types.ObjectId().toString()
    });
    expect(fallbackTeam.tmbId).toBe(String(activeMember._id));
  });
});
