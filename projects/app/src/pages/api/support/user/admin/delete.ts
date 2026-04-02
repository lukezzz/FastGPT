import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { ERROR_ENUM } from '@fastgpt/global/common/error/errorCode';
import { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { delUserAllSession } from '@fastgpt/service/support/user/session';

export type adminDeleteUserQuery = {};
export type adminDeleteUserBody = {
  userId: string;
};
export type adminDeleteUserResponse = {};

async function handler(
  req: ApiRequestProps<adminDeleteUserBody, adminDeleteUserQuery>,
  _res: ApiResponseType<adminDeleteUserResponse>
): Promise<adminDeleteUserResponse> {
  await authSystemAdmin({ req });

  const params = {
    ...(req.query || {}),
    ...(req.body || {})
  } as adminDeleteUserBody;
  const userId = params.userId?.trim();

  if (!userId) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const user = await MongoUser.findById(userId);
  if (!user) {
    return Promise.reject(UserErrEnum.notUser);
  }
  if (user.username === 'root') {
    return Promise.reject(ERROR_ENUM.unAuthorization);
  }

  await MongoUser.findByIdAndUpdate(userId, {
    status: UserStatusEnum.forbidden
  });
  await delUserAllSession(String(userId));

  return {};
}

export default NextAPI(handler);
