'use client';
import React from 'react';
import { Box, Button, Card, Flex, FormControl, FormLabel, Input, Switch } from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { serviceSideProps } from '@/web/common/i18n/utils';
import AccountContainer from '@/pageComponents/account/AccountContainer';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useTranslation } from 'next-i18next';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useRequest2 } from '@fastgpt/web/hooks/useRequest';
import {
  getAdminSSOConfig,
  putAdminSSOConfig,
  type AdminSSOConfig
} from '@/web/support/user/admin/api';
import { getWebReqUrl } from '@fastgpt/web/common/system/utils';

const AccountSSOPage = () => {
  const { t } = useTranslation();
  const { userInfo } = useUserStore();
  const isRoot = userInfo?.username === 'root';
  const { register, handleSubmit, reset, watch, setValue } = useForm<AdminSSOConfig>({
    defaultValues: {
      enabled: false,
      tenantId: '',
      clientId: '',
      clientSecret: '',
      title: 'Microsoft Entra ID'
    }
  });

  const enabled = watch('enabled');

  const { loading } = useRequest2(getAdminSSOConfig, {
    manual: !isRoot,
    refreshDeps: [isRoot],
    onSuccess: (data) => reset(data)
  });

  const { runAsync: saveConfig, loading: saving } = useRequest2(putAdminSSOConfig, {
    successToast: t('account:sso_save_success')
  });
  const callbackUrl =
    typeof window === 'undefined'
      ? '/login/provider'
      : `${location.origin}${getWebReqUrl('/login/provider')}`;

  return (
    <AccountContainer isLoading={loading}>
      <Flex h={'100%'} flexDirection={'column'} gap={4} py={4} px={6}>
        <Flex alignItems={'center'} gap={2} color={'myGray.900'}>
          <MyIcon name={'common/settingLight'} w={'20px'} h={'20px'} />
          <Box fontWeight={'500'} fontSize={'1rem'}>
            {t('account:sso')}
          </Box>
        </Flex>

        {!isRoot ? (
          <Box color={'myGray.600'} fontSize={'sm'}>
            {t('common:not_permission')}
          </Box>
        ) : (
          <Card as={'form'} px={[4, 8]} py={[4, 6]} gap={6} onSubmit={handleSubmit(saveConfig)}>
            <FormControl display={'flex'} alignItems={'center'} justifyContent={'space-between'}>
              <Box>
                <FormLabel mb={1}>{t('account:sso_enable')}</FormLabel>
                <Box color={'myGray.500'} fontSize={'sm'}>
                  {t('account:sso_enable_tip')}
                </Box>
              </Box>
              <Switch
                isChecked={enabled}
                onChange={(e) => setValue('enabled', e.target.checked, { shouldDirty: true })}
              />
            </FormControl>

            <FormControl>
              <FormLabel>{t('account:sso_button_title')}</FormLabel>
              <Input bg={'myGray.50'} placeholder={'Microsoft Entra ID'} {...register('title')} />
            </FormControl>

            <FormControl isRequired={enabled}>
              <FormLabel>{t('account:sso_tenant_id')}</FormLabel>
              <Input
                bg={'myGray.50'}
                placeholder={t('account:sso_tenant_id_placeholder')}
                {...register('tenantId')}
              />
            </FormControl>

            <FormControl isRequired={enabled}>
              <FormLabel>{t('account:sso_client_id')}</FormLabel>
              <Input
                bg={'myGray.50'}
                placeholder={t('account:sso_client_id_placeholder')}
                {...register('clientId')}
              />
            </FormControl>

            <FormControl isRequired={enabled}>
              <FormLabel>{t('account:sso_client_secret')}</FormLabel>
              <Input
                bg={'myGray.50'}
                type={'password'}
                placeholder={t('account:sso_client_secret_placeholder')}
                {...register('clientSecret')}
              />
            </FormControl>

            <Box color={'myGray.500'} fontSize={'sm'}>
              {t('account:sso_callback_tip', {
                origin: callbackUrl.replace(/\/login\/provider$/, '')
              })}
            </Box>

            <Flex justifyContent={'flex-end'}>
              <Button type={'submit'} variant={'primary'} isLoading={saving}>
                {t('common:Save')}
              </Button>
            </Flex>
          </Card>
        )}
      </Flex>
    </AccountContainer>
  );
};

export async function getServerSideProps(content: any) {
  return {
    props: {
      ...(await serviceSideProps(content, ['account']))
    }
  };
}

export default AccountSSOPage;
