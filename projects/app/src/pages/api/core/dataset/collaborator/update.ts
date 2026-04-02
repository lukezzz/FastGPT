import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import {
  ManagePermissionVal,
  PerResourceTypeEnum
} from '@fastgpt/global/support/permission/constant';
import { authDataset } from '@fastgpt/service/support/permission/dataset/auth';
import type { UpdateDatasetCollaboratorBody } from '@fastgpt/global/core/dataset/collaborator';
import { upsertResourceCollaborators } from '@fastgpt/service/support/permission/collaborator';
import { MongoDataset } from '@fastgpt/service/core/dataset/schema';

export type postUpdateDatasetCollaboratorQuery = {};
export type postUpdateDatasetCollaboratorBody = UpdateDatasetCollaboratorBody;
export type postUpdateDatasetCollaboratorResponse = {};

async function handler(
  req: ApiRequestProps<postUpdateDatasetCollaboratorBody, postUpdateDatasetCollaboratorQuery>,
  _res: ApiResponseType<postUpdateDatasetCollaboratorResponse>
): Promise<postUpdateDatasetCollaboratorResponse> {
  const datasetId = req.body.datasetId?.trim();

  const { teamId, dataset } = await authDataset({
    req,
    authToken: true,
    datasetId,
    per: ManagePermissionVal
  });

  await upsertResourceCollaborators({
    teamId,
    resourceType: PerResourceTypeEnum.dataset,
    resourceId: datasetId,
    members: req.body.members,
    groups: req.body.groups,
    orgs: req.body.orgs,
    permission: req.body.permission
  });

  if (dataset.parentId && dataset.inheritPermission) {
    await MongoDataset.findByIdAndUpdate(datasetId, {
      inheritPermission: false
    });
  }

  return {};
}

export default NextAPI(handler);
