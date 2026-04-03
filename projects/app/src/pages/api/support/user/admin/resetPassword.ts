import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { ERROR_ENUM } from '@fastgpt/global/common/error/errorCode';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { delUserAllSession } from '@fastgpt/service/support/user/session';
import { hashStr } from '@fastgpt/global/common/string/tools';

export type adminResetPasswordQuery = {};
export type adminResetPasswordBody = {
  userId: string;
  newPassword: string;
};
export type adminResetPasswordResponse = {};

const normalizeClientPassword = (password: string) => {
  return /^[a-f0-9]{64}$/i.test(password) ? password : hashStr(password);
};

async function handler(
  req: ApiRequestProps<adminResetPasswordBody, adminResetPasswordQuery>,
  _res: ApiResponseType<adminResetPasswordResponse>
): Promise<adminResetPasswordResponse> {
  await authSystemAdmin({ req });

  const userId = req.body.userId?.trim();
  const newPassword = req.body.newPassword?.trim();

  if (!userId || !newPassword) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const user = await MongoUser.findById(userId, '_id username').lean();
  if (!user) {
    return Promise.reject(UserErrEnum.notUser);
  }
  if (user.username === 'root') {
    return Promise.reject(ERROR_ENUM.unAuthorization);
  }

  await MongoUser.findByIdAndUpdate(userId, {
    password: normalizeClientPassword(newPassword),
    passwordUpdateTime: new Date()
  });
  if (process.env.NODE_ENV !== 'test') {
    try {
      await delUserAllSession(userId);
    } catch (error) {
      console.log('reset password: clear session failed', error);
    }
  }

  return {};
}

export default NextAPI(handler);
