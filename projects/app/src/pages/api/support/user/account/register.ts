import type { NextApiRequest, NextApiResponse } from 'next';
import { NextAPI } from '@/service/middleware/entry';
import { useIPFrequencyLimit } from '@fastgpt/service/common/middle/reqFrequencyLimit';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { authUserExist, getUserDetail } from '@fastgpt/service/support/user/controller';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { createDefaultTeam } from '@fastgpt/service/support/user/team/controller';
import { createUserSession } from '@fastgpt/service/support/user/session';
import { setCookie } from '@fastgpt/service/support/permission/controller';
import { DEFAULT_TEAM_AVATAR } from '@fastgpt/global/common/system/constants';
import type { ResLogin } from '@/global/support/api/userRes';
import { hashStr } from '@fastgpt/global/common/string/tools';
import requestIp from 'request-ip';

type RegisterBody = {
  username: string;
  password: string;
  teamName: string;
  inviterId?: string;
  fastgpt_sem?: {
    keyword: string;
  };
  sourceDomain?: string;
};

const normalizeClientPassword = (password: string) => {
  return /^[a-f0-9]{64}$/i.test(password) ? password : hashStr(password);
};

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<ResLogin> {
  const { username, password, teamName, inviterId, fastgpt_sem, sourceDomain } =
    req.body as RegisterBody;

  const formatUsername = username?.trim();
  const formatTeamName = teamName?.trim();
  const formatPassword = password?.trim();

  if (!formatUsername || !formatPassword || !formatTeamName) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  if (formatUsername.length > 120 || formatTeamName.length > 100) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const existsUser = await authUserExist({ username: formatUsername });
  if (existsUser) {
    return Promise.reject(UserErrEnum.userExist);
  }

  const registerResult = await mongoSessionRun(async (session) => {
    const [createdUser] = await MongoUser.create(
      [
        {
          username: formatUsername,
          password: normalizeClientPassword(formatPassword),
          passwordUpdateTime: new Date(),
          ...(inviterId ? { inviterId } : {}),
          ...(fastgpt_sem ? { fastgpt_sem } : {}),
          ...(sourceDomain ? { sourceDomain } : {})
        }
      ],
      { session, ordered: true }
    );

    const tmb = await createDefaultTeam({
      userId: String(createdUser._id),
      teamName: formatTeamName,
      memberName: formatUsername,
      avatar: DEFAULT_TEAM_AVATAR,
      session
    });

    if (!tmb) {
      return Promise.reject('Create team failed');
    }

    await MongoUser.findByIdAndUpdate(
      createdUser._id,
      {
        lastLoginTmbId: tmb._id
      },
      { session }
    );

    return {
      userId: String(createdUser._id),
      teamId: String(tmb.teamId),
      tmbId: String(tmb._id)
    };
  });

  const user = await getUserDetail({ tmbId: registerResult.tmbId });
  const token = await createUserSession({
    userId: registerResult.userId,
    teamId: registerResult.teamId,
    tmbId: registerResult.tmbId,
    ip: requestIp.getClientIp(req)
  });

  setCookie(res, token);

  return {
    user,
    token
  };
}

const lockTime = Number(process.env.REGISTER_LOCK_SECONDS || 120);
export default NextAPI(
  useIPFrequencyLimit({ id: 'register-local-user', seconds: lockTime, limit: 10, force: true }),
  handler
);
