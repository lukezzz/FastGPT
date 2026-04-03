import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { createTeam } from '@fastgpt/service/support/user/team/controller';

export type adminCreateTeamQuery = {};
export type adminCreateTeamBody = {
  ownerUserId: string;
  name: string;
};
export type adminCreateTeamResponse = {
  teamId: string;
  tmbId: string;
};

async function handler(
  req: ApiRequestProps<adminCreateTeamBody, adminCreateTeamQuery>,
  _res: ApiResponseType<adminCreateTeamResponse>
): Promise<adminCreateTeamResponse> {
  await authSystemAdmin({ req });

  const ownerUserId = req.body.ownerUserId?.trim();
  const name = req.body.name?.trim();

  if (!ownerUserId || !name) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  const owner = await MongoUser.findById(ownerUserId, '_id username').lean();
  if (!owner) {
    return Promise.reject(UserErrEnum.notUser);
  }

  const tmb = await createTeam({
    userId: String(owner._id),
    teamName: name,
    memberName: owner.username
  });

  await MongoUser.findByIdAndUpdate(owner._id, {
    lastLoginTmbId: tmb._id
  });

  return {
    teamId: String(tmb.teamId),
    tmbId: String(tmb._id)
  };
}

export default NextAPI(handler);
