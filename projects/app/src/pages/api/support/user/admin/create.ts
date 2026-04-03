import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { authUserExist } from '@fastgpt/service/support/user/controller';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { hashStr } from '@fastgpt/global/common/string/tools';

export type adminCreateUserQuery = {};
export type adminCreateUserBody = {
  username: string;
  password: string;
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

  const { username, password } = req.body;
  const formatUsername = username?.trim();
  const formatPassword = password?.trim();

  if (!formatUsername || !formatPassword) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const existsUser = await authUserExist({ username: formatUsername });
  if (existsUser) {
    return Promise.reject(UserErrEnum.userExist);
  }

  const [createdUser] = await MongoUser.create([
    {
      username: formatUsername,
      password: normalizeClientPassword(formatPassword),
      passwordUpdateTime: new Date()
    }
  ]);

  return {
    userId: String(createdUser._id)
  };
}

export default NextAPI(handler);
