import { SystemConfigsTypeEnum } from '@fastgpt/global/common/system/config/constants';
import { MongoSystemConfigs } from './schema';
import { type FastGPTConfigFileType } from '@fastgpt/global/common/system/types';
import { type LicenseDataType } from '@fastgpt/global/common/system/types';

export const getLatestFastGPTConfig = async () => {
  return MongoSystemConfigs.findOne({
    type: SystemConfigsTypeEnum.fastgpt
  }).sort({
    createTime: -1
  });
};

export const getFastGPTConfigFromDB = async (): Promise<{
  fastgptConfig: FastGPTConfigFileType;
  licenseData?: LicenseDataType;
}> => {
  const [fastgptConfig, licenseConfig] = await Promise.all([
    getLatestFastGPTConfig(),
    MongoSystemConfigs.findOne({
      type: SystemConfigsTypeEnum.license
    }).sort({
      createTime: -1
    })
  ]);

  const config = fastgptConfig?.value || {};
  const licenseData = licenseConfig?.value?.data as LicenseDataType | undefined;

  const fastgptConfigTime = fastgptConfig?.createTime.getTime().toString();
  const licenseConfigTime = licenseConfig?.createTime.getTime().toString();
  // 利用配置文件的创建时间（更新时间）来做缓存，如果前端命中缓存，则不需要再返回配置文件
  global.systemInitBufferId = fastgptConfigTime
    ? `${fastgptConfigTime}-${licenseConfigTime}`
    : undefined;

  return {
    fastgptConfig: config as FastGPTConfigFileType,
    licenseData
  };
};

export const upsertFastGPTConfig = async (value: FastGPTConfigFileType) => {
  const latest = await getLatestFastGPTConfig();

  if (latest) {
    latest.value = value as Record<string, any>;
    await latest.save();
    return latest;
  }

  const [created] = await MongoSystemConfigs.create([
    {
      type: SystemConfigsTypeEnum.fastgpt,
      value
    }
  ]);

  return created;
};

export const updateFastGPTConfigBuffer = async () => {
  const res = await getLatestFastGPTConfig();

  if (!res) return;

  res.createTime = new Date();
  await res.save();

  global.systemInitBufferId = res.createTime.getTime().toString();
};

export const reloadFastGPTConfigBuffer = async () => {
  const res = await getLatestFastGPTConfig();
  if (!res) return;
  global.systemInitBufferId = res.createTime.getTime().toString();
};
