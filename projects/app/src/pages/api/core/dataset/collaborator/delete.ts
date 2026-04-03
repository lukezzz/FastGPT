import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import {
  ManagePermissionVal,
  PerResourceTypeEnum
} from '@fastgpt/global/support/permission/constant';
import { authDataset } from '@fastgpt/service/support/permission/dataset/auth';
import type { DatasetCollaboratorDeleteParams } from '@fastgpt/global/core/dataset/collaborator';
import { deleteResourceCollaborator } from '@fastgpt/service/support/permission/collaborator';
import { MongoDataset } from '@fastgpt/service/core/dataset/schema';

export type deleteDatasetCollaboratorQuery = DatasetCollaboratorDeleteParams;
export type deleteDatasetCollaboratorBody = DatasetCollaboratorDeleteParams;
export type deleteDatasetCollaboratorResponse = {};

async function handler(
  req: ApiRequestProps<deleteDatasetCollaboratorBody, deleteDatasetCollaboratorQuery>,
  _res: ApiResponseType<deleteDatasetCollaboratorResponse>
): Promise<deleteDatasetCollaboratorResponse> {
  const params = {
    ...(req.query || {}),
    ...(req.body || {})
  } as DatasetCollaboratorDeleteParams;

  const datasetId = params.datasetId?.trim();

  const { teamId, dataset } = await authDataset({
    req,
    authToken: true,
    datasetId,
    per: ManagePermissionVal
  });

  await deleteResourceCollaborator({
    teamId,
    resourceType: PerResourceTypeEnum.dataset,
    resourceId: datasetId,
    tmbId: params.tmbId,
    groupId: params.groupId,
    orgId: params.orgId
  });

  if (dataset.parentId && dataset.inheritPermission) {
    await MongoDataset.findByIdAndUpdate(datasetId, {
      inheritPermission: false
    });
  }

  return {};
}

export default NextAPI(handler);
