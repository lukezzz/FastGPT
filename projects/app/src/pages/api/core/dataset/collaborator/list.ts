import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import {
  ReadPermissionVal,
  PerResourceTypeEnum
} from '@fastgpt/global/support/permission/constant';
import { authDataset } from '@fastgpt/service/support/permission/dataset/auth';
import type { CollaboratorItemType } from '@fastgpt/global/support/permission/collaborator';
import { getResourceCollaborators } from '@fastgpt/service/support/permission/collaborator';

export type getDatasetCollaboratorListQuery = {
  datasetId: string;
};
export type getDatasetCollaboratorListBody = {};
export type getDatasetCollaboratorListResponse = CollaboratorItemType[];

async function handler(
  req: ApiRequestProps<getDatasetCollaboratorListBody, getDatasetCollaboratorListQuery>,
  _res: ApiResponseType<getDatasetCollaboratorListResponse>
): Promise<getDatasetCollaboratorListResponse> {
  const datasetId = req.query.datasetId?.trim();

  const { teamId } = await authDataset({
    req,
    authToken: true,
    datasetId,
    per: ReadPermissionVal
  });

  return getResourceCollaborators({
    teamId,
    resourceType: PerResourceTypeEnum.dataset,
    resourceId: datasetId
  });
}

export default NextAPI(handler);
