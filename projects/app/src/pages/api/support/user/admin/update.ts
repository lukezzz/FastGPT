import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { ERROR_ENUM } from '@fastgpt/global/common/error/errorCode';
import type { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';

export type adminUpdateUserQuery = {};
export type adminUpdateUserBody = {
  userId: string;
  timezone?: string;
  status?: `${UserStatusEnum}`;
};
export type adminUpdateUserResponse = {};

async function handler(
  req: ApiRequestProps<adminUpdateUserBody, adminUpdateUserQuery>,
  _res: ApiResponseType<adminUpdateUserResponse>
): Promise<adminUpdateUserResponse> {
  await authSystemAdmin({ req });

  const { userId, timezone, status } = req.body;

  if (!userId || (!timezone && !status)) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const user = await MongoUser.findById(userId);
  if (!user) {
    return Promise.reject(UserErrEnum.notUser);
  }
  if (user.username === 'root' && status && status !== user.status) {
    return Promise.reject(ERROR_ENUM.unAuthorization);
  }

  await MongoUser.findByIdAndUpdate(userId, {
    ...(timezone ? { timezone } : {}),
    ...(status ? { status } : {})
  });

  return {};
}

export default NextAPI(handler);
