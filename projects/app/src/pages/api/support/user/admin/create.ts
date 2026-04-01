import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { authUserExist } from '@fastgpt/service/support/user/controller';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { createDefaultTeam } from '@fastgpt/service/support/user/team/controller';
import { DEFAULT_TEAM_AVATAR } from '@fastgpt/global/common/system/constants';
import { hashStr } from '@fastgpt/global/common/string/tools';

export type adminCreateUserQuery = {};
export type adminCreateUserBody = {
  username: string;
  password: string;
  teamName?: string;
};
export type adminCreateUserResponse = {
  userId: string;
};

const normalizeClientPassword = (password: string) => {
  return /^[a-f0-9]{64}$/i.test(password) ? password : hashStr(password);
};

async function handler(
  req: ApiRequestProps<adminCreateUserBody, adminCreateUserQuery>,
  _res: ApiResponseType<adminCreateUserResponse>
): Promise<adminCreateUserResponse> {
  await authSystemAdmin({ req });

  const { username, password, teamName } = req.body;
  const formatUsername = username?.trim();
  const formatTeamName = teamName?.trim() || 'My Team';
  const formatPassword = password?.trim();

  if (!formatUsername || !formatPassword) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const existsUser = await authUserExist({ username: formatUsername });
  if (existsUser) {
    return Promise.reject(UserErrEnum.userExist);
  }

  const userId = await mongoSessionRun(async (session) => {
    const [createdUser] = await MongoUser.create(
      [
        {
          username: formatUsername,
          password: normalizeClientPassword(formatPassword),
          passwordUpdateTime: new Date()
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

    if (tmb) {
      await MongoUser.findByIdAndUpdate(
        createdUser._id,
        {
          lastLoginTmbId: tmb._id
        },
        { session }
      );
    }

    return String(createdUser._id);
  });

  return {
    userId
  };
}

export default NextAPI(handler);
