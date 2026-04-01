'use client';
import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  FormControl,
  Input,
  ModalBody,
  ModalFooter,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  Tag
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import format from 'date-fns/format';
import { serviceSideProps } from '@/web/common/i18n/utils';
import AccountContainer from '@/pageComponents/account/AccountContainer';
import SearchInput from '@fastgpt/web/components/common/Input/SearchInput';
import MySelect from '@fastgpt/web/components/common/MySelect';
import MyModal from '@fastgpt/web/components/common/MyModal';
import MyBox from '@fastgpt/web/components/common/MyBox';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useRequest2 } from '@fastgpt/web/hooks/useRequest';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import { useTranslation } from 'next-i18next';
import { useUserStore } from '@/web/support/user/useUserStore';
import {
  delAdminUser,
  getAdminUserList,
  postAdminCreateUser,
  putAdminUpdateUser,
  type AdminUserItem
} from '@/web/support/user/admin/api';
import { UserStatusEnum, userStatusMap } from '@fastgpt/global/support/user/constant';

type CreateUserFormType = {
  username: string;
  password: string;
  teamName: string;
};

type EditUserFormType = {
  timezone: string;
  status: `${UserStatusEnum}`;
};

const pageSize = 20;

const UserAdminPage = () => {
  const { t } = useTranslation();
  const { userInfo } = useUserStore();
  const isRoot = userInfo?.username === 'root';

  const [pageNum, setPageNum] = useState(1);
  const [searchKey, setSearchKey] = useState('');
  const [status, setStatus] = useState<`${UserStatusEnum}` | undefined>();
  const [editingUser, setEditingUser] = useState<AdminUserItem>();

  const { isOpen: isOpenCreate, onOpen: onOpenCreate, onClose: onCloseCreate } = useDisclosure();

  const {
    data: userListResponse,
    loading,
    refresh: refreshUserList
  } = useRequest2(
    async () => {
      if (!isRoot) {
        return {
          total: 0,
          list: []
        };
      }

      return getAdminUserList({
        pageNum,
        pageSize,
        searchKey: searchKey.trim() || undefined,
        status
      });
    },
    {
      manual: false,
      refreshDeps: [isRoot, pageNum, searchKey, status]
    }
  );

  const total = userListResponse?.total || 0;
  const userList = userListResponse?.list || [];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const statusOptions = useMemo(
    () => [
      {
        label: t('common:All'),
        value: undefined
      },
      {
        label: t(userStatusMap[UserStatusEnum.active].label as any),
        value: UserStatusEnum.active
      },
      {
        label: t(userStatusMap[UserStatusEnum.forbidden].label as any),
        value: UserStatusEnum.forbidden
      }
    ],
    [t]
  );

  const { ConfirmModal, openConfirm } = useConfirm({
    type: 'delete',
    title: 'Disable User',
    content: 'This will disable the user and clear their active sessions.'
  });
  const { runAsync: disableUser } = useRequest2(delAdminUser, {
    successToast: t('common:Success'),
    onSuccess: () => refreshUserList()
  });

  return (
    <AccountContainer>
      <Flex h={'100%'} flexDirection={'column'} gap={4} py={4} px={6}>
        <Flex alignItems={'center'} justifyContent={'space-between'}>
          <Flex alignItems={'center'} gap={2} color={'myGray.900'}>
            <MyIcon name={'support/user/usersLight'} w={'20px'} h={'20px'} />
            <Box fontWeight={'500'} fontSize={'1rem'}>
              Users
            </Box>
          </Flex>
          {isRoot && (
            <Button variant={'primary'} onClick={onOpenCreate}>
              Create User
            </Button>
          )}
        </Flex>

        {!isRoot ? (
          <Box color={'myGray.600'} fontSize={'sm'}>
            {t('common:not_permission')}
          </Box>
        ) : (
          <>
            <Flex alignItems={'center'} gap={3} flexWrap={'wrap'}>
              <Box w={'260px'}>
                <SearchInput
                  placeholder={'Search username'}
                  value={searchKey}
                  onChange={(e) => {
                    setPageNum(1);
                    setSearchKey(e.target.value);
                  }}
                />
              </Box>
              <Box w={'180px'}>
                <MySelect
                  value={status}
                  list={statusOptions}
                  onChange={(val) => {
                    setPageNum(1);
                    setStatus(val);
                  }}
                />
              </Box>
              <Box flex={1} />
              <Text fontSize={'sm'} color={'myGray.600'}>
                {`Total ${total}`}
              </Text>
            </Flex>

            <MyBox flex={'1 0 0'} h={0} isLoading={loading}>
              <TableContainer h={'100%'} overflowY={'auto'} fontSize={'sm'}>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Username</Th>
                      <Th>Status</Th>
                      <Th>Timezone</Th>
                      <Th>Created</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {userList.map((user) => {
                      const isRootUser = user.username === 'root';
                      const isForbidden = user.status === UserStatusEnum.forbidden;

                      return (
                        <Tr key={user._id} _hover={{ bg: 'myGray.50' }}>
                          <Td>{user.username}</Td>
                          <Td>
                            <Tag colorScheme={isForbidden ? 'red' : 'green'}>
                              {t(userStatusMap[user.status].label as any)}
                            </Tag>
                          </Td>
                          <Td>{user.timezone || '-'}</Td>
                          <Td>{format(new Date(user.createTime), 'yyyy-MM-dd HH:mm:ss')}</Td>
                          <Td>
                            <Flex gap={2} flexWrap={'wrap'}>
                              <Button
                                size={'sm'}
                                variant={'whitePrimary'}
                                onClick={() => setEditingUser(user)}
                              >
                                Edit
                              </Button>
                              {!isRootUser && !isForbidden && (
                                <Button
                                  size={'sm'}
                                  variant={'dangerFill'}
                                  onClick={() => openConfirm(() => disableUser(user._id))()}
                                >
                                  Disable
                                </Button>
                              )}
                              {!isRootUser && isForbidden && (
                                <Button
                                  size={'sm'}
                                  variant={'whitePrimary'}
                                  onClick={async () => {
                                    await putAdminUpdateUser({
                                      userId: user._id,
                                      status: UserStatusEnum.active,
                                      timezone: user.timezone
                                    });
                                    refreshUserList();
                                  }}
                                >
                                  Restore
                                </Button>
                              )}
                            </Flex>
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </TableContainer>
            </MyBox>

            <Flex alignItems={'center'} justifyContent={'flex-end'} gap={3}>
              <Text fontSize={'sm'} color={'myGray.600'}>
                {`Page ${pageNum} / ${totalPages}`}
              </Text>
              <Button
                size={'sm'}
                variant={'whitePrimary'}
                isDisabled={pageNum <= 1}
                onClick={() => setPageNum((prev) => Math.max(1, prev - 1))}
              >
                Prev
              </Button>
              <Button
                size={'sm'}
                variant={'whitePrimary'}
                isDisabled={pageNum >= totalPages}
                onClick={() => setPageNum((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </Flex>
          </>
        )}
      </Flex>

      {isOpenCreate && (
        <CreateUserModal
          onClose={onCloseCreate}
          onSuccess={() => {
            setPageNum(1);
            refreshUserList();
          }}
        />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(undefined)}
          onSuccess={() => refreshUserList()}
        />
      )}
      <ConfirmModal />
    </AccountContainer>
  );
};

function CreateUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { t } = useTranslation();
  const { register, handleSubmit } = useForm<CreateUserFormType>({
    defaultValues: {
      username: '',
      password: '',
      teamName: ''
    }
  });

  const { runAsync, loading } = useRequest2(postAdminCreateUser, {
    successToast: t('common:create_success'),
    onSuccess: () => {
      onSuccess();
      onClose();
    }
  });

  return (
    <MyModal title={'Create User'} isOpen onClose={onClose} isLoading={loading}>
      <ModalBody>
        <FormControl>
          <Box mb={1} fontSize={'sm'}>
            Username
          </Box>
          <Input {...register('username', { required: true })} />
        </FormControl>
        <FormControl mt={4}>
          <Box mb={1} fontSize={'sm'}>
            Password
          </Box>
          <Input type={'password'} {...register('password', { required: true })} />
        </FormControl>
        <FormControl mt={4}>
          <Box mb={1} fontSize={'sm'}>
            Team Name
          </Box>
          <Input {...register('teamName')} />
        </FormControl>
      </ModalBody>
      <ModalFooter>
        <Button variant={'whiteBase'} onClick={onClose}>
          {t('common:Cancel')}
        </Button>
        <Button ml={3} variant={'primary'} onClick={handleSubmit((data) => runAsync(data))}>
          {t('common:Confirm')}
        </Button>
      </ModalFooter>
    </MyModal>
  );
}

function EditUserModal({
  user,
  onClose,
  onSuccess
}: {
  user: AdminUserItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const isRootUser = user.username === 'root';
  const { register, handleSubmit, watch, setValue } = useForm<EditUserFormType>({
    defaultValues: {
      timezone: user.timezone || '',
      status: user.status
    }
  });

  const statusValue = watch('status');

  const { runAsync, loading } = useRequest2(putAdminUpdateUser, {
    successToast: t('common:update_success'),
    onSuccess: () => {
      onSuccess();
      onClose();
    }
  });

  return (
    <MyModal title={`Edit ${user.username}`} isOpen onClose={onClose} isLoading={loading}>
      <ModalBody>
        <FormControl>
          <Box mb={1} fontSize={'sm'}>
            Timezone
          </Box>
          <Input {...register('timezone')} />
        </FormControl>
        <FormControl mt={4}>
          <Box mb={1} fontSize={'sm'}>
            Status
          </Box>
          <MySelect
            value={statusValue}
            isDisabled={isRootUser}
            list={[
              {
                label: t(userStatusMap[UserStatusEnum.active].label as any),
                value: UserStatusEnum.active
              },
              {
                label: t(userStatusMap[UserStatusEnum.forbidden].label as any),
                value: UserStatusEnum.forbidden
              }
            ]}
            onChange={(value) => setValue('status', value)}
          />
        </FormControl>
      </ModalBody>
      <ModalFooter>
        <Button variant={'whiteBase'} onClick={onClose}>
          {t('common:Cancel')}
        </Button>
        <Button
          ml={3}
          variant={'primary'}
          onClick={handleSubmit((data) =>
            runAsync({
              userId: user._id,
              timezone: data.timezone?.trim() || user.timezone,
              status: isRootUser ? user.status : data.status
            })
          )}
        >
          {t('common:Confirm')}
        </Button>
      </ModalFooter>
    </MyModal>
  );
}

export async function getServerSideProps(content: any) {
  return {
    props: {
      ...(await serviceSideProps(content, ['account', 'common', 'user']))
    }
  };
}

export default UserAdminPage;
