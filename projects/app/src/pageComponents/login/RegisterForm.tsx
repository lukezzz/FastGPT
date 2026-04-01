import React, { type Dispatch } from 'react';
import { FormControl, Box, Input, Button } from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { LoginPageTypeEnum } from '@/web/support/user/login/constants';
import { postRegister } from '@/web/support/user/api';
import type { ResLogin } from '@/global/support/api/userRes';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { postCreateApp } from '@/web/core/app/api';
import { emptyTemplates } from '@/web/core/app/templates';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useTranslation } from 'next-i18next';
import type { AppTypeEnum } from '@fastgpt/global/core/app/constants';
import { useRequest2 } from '@fastgpt/web/hooks/useRequest';
import {
  getBdVId,
  getFastGPTSem,
  getInviterId,
  getSourceDomain,
  removeFastGPTSem
} from '@/web/support/marketing/utils';
import { checkPasswordRule } from '@fastgpt/global/common/string/password';

interface Props {
  loginSuccess: (e: ResLogin) => void;
  setPageType: Dispatch<`${LoginPageTypeEnum}`>;
}

interface RegisterType {
  username: string;
  teamName: string;
  password: string;
  password2: string;
}

const RegisterForm = ({ setPageType, loginSuccess }: Props) => {
  const { toast } = useToast();
  const { t } = useTranslation();

  const { feConfigs } = useSystemStore();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors }
  } = useForm<RegisterType>({
    mode: 'onBlur'
  });

  const { runAsync: onclickRegister, loading: requesting } = useRequest2(
    async ({ username, password, teamName }: RegisterType) => {
      loginSuccess(
        await postRegister({
          username,
          teamName,
          password,
          inviterId: getInviterId(),
          bd_vid: getBdVId(),
          fastgpt_sem: getFastGPTSem(),
          sourceDomain: getSourceDomain()
        })
      );
      removeFastGPTSem();

      toast({
        status: 'success',
        title: t('user:register.success')
      });

      // auto register template app
      setTimeout(() => {
        Object.entries(emptyTemplates).map(([type, emptyTemplate]) => {
          postCreateApp({
            avatar: emptyTemplate.avatar,
            name: t(emptyTemplate.name as any),
            modules: emptyTemplate.nodes,
            edges: emptyTemplate.edges,
            type: type as AppTypeEnum
          });
        });
      }, 100);
    },
    {
      refreshDeps: [loginSuccess, t, toast]
    }
  );
  const onSubmitErr = (err: Record<string, any>) => {
    const val = Object.values(err)[0];
    if (!val) return;
    if (val.message) {
      toast({
        status: 'warning',
        title: val.message,
        duration: 3000,
        isClosable: true
      });
    }
  };

  const placeholder = [
    t('common:support.user.login.Username'),
    t('common:support.user.login.Email')
  ].join('/');

  return (
    <>
      <Box fontWeight={'medium'} fontSize={'lg'} textAlign={'center'} color={'myGray.900'}>
        {t('user:register.register_account', { account: feConfigs?.systemTitle })}
      </Box>
      <Box
        mt={9}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !requesting) {
            handleSubmit(onclickRegister, onSubmitErr)();
          }
        }}
      >
        <FormControl isInvalid={!!errors.username}>
          <Input
            bg={'myGray.50'}
            size={'lg'}
            placeholder={placeholder}
            {...register('username', {
              required: t('common:error.username_empty')
            })}
          ></Input>
        </FormControl>
        <FormControl mt={6} isInvalid={!!errors.teamName}>
          <Input
            size={'lg'}
            bg={'myGray.50'}
            maxLength={100}
            placeholder={t('user:team.Team Name')}
            {...register('teamName', {
              required: t('common:please_input_name')
            })}
          ></Input>
        </FormControl>
        <FormControl mt={6} isInvalid={!!errors.password}>
          <Input
            bg={'myGray.50'}
            size={'lg'}
            type={'password'}
            placeholder={t('login:password_tip')}
            {...register('password', {
              required: true,
              validate: (val) => {
                if (!checkPasswordRule(val)) {
                  return t('login:password_tip');
                }
                return true;
              }
            })}
          ></Input>
        </FormControl>
        <FormControl mt={6} isInvalid={!!errors.password2}>
          <Input
            bg={'myGray.50'}
            size={'lg'}
            type={'password'}
            placeholder={t('user:password.confirm')}
            {...register('password2', {
              validate: (val) =>
                getValues('password') === val ? true : t('user:password.not_match')
            })}
          />
        </FormControl>
        <Button
          type="submit"
          mt={12}
          w={'100%'}
          size={['md', 'md']}
          rounded={['md', 'md']}
          h={[10, 10]}
          fontWeight={['medium', 'medium']}
          colorScheme="blue"
          isLoading={requesting}
          onClick={handleSubmit(onclickRegister, onSubmitErr)}
        >
          {t('user:register.confirm')}
        </Button>
        <Box
          float={'right'}
          fontSize="mini"
          mt={3}
          mb={'50px'}
          fontWeight={'medium'}
          color={'primary.700'}
          cursor={'pointer'}
          _hover={{ textDecoration: 'underline' }}
          onClick={() => setPageType(LoginPageTypeEnum.passwordLogin)}
        >
          {t('user:register.to_login')}
        </Box>
      </Box>
    </>
  );
};

export default RegisterForm;
