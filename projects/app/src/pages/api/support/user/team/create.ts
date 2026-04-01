import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import type { CreateTeamProps } from '@fastgpt/global/support/user/team/controller.d';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { createTeam } from '@fastgpt/service/support/user/team/controller';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';

export type createTeamQuery = {};
export type createTeamBody = CreateTeamProps;
export type createTeamResponse = string;

async function handler(
  req: ApiRequestProps<createTeamBody, createTeamQuery>,
  _res: ApiResponseType<createTeamResponse>
): Promise<createTeamResponse> {
  const { name, avatar, memberName, notificationAccount } = req.body;

  if (!name?.trim()) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const { userId } = await authCert({ req, authToken: true });
  const tmb = await createTeam({
    userId,
    teamName: name.trim(),
    avatar,
    memberName,
    notificationAccount
  });

  return String(tmb.teamId);
}

export default NextAPI(handler);
