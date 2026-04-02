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
import FillRowTabs from '@fastgpt/web/components/common/Tabs/FillRowTabs';
import { useRequest2 } from '@fastgpt/web/hooks/useRequest';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import { useTranslation } from 'next-i18next';
import { useUserStore } from '@/web/support/user/useUserStore';
import {
  delAdminUnbindUserTeam,
  delAdminDeleteTeam,
  delAdminUser,
  getAdminTeamList,
  getAdminUserList,
  postAdminBindUserTeam,
  postAdminCreateTeam,
  postAdminCreateUser,
  postAdminResetPassword,
  putAdminUpdateUser,
  type AdminUserItem
} from '@/web/support/user/admin/api';
import { UserStatusEnum, userStatusMap } from '@fastgpt/global/support/user/constant';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { checkPasswordRule } from '@fastgpt/global/common/string/password';

type CreateUserFormType = {
  username: string;
  password: string;
};

type EditUserFormType = {
  timezone: string;
  status: `${UserStatusEnum}`;
};

type ResetPasswordFormType = {
  newPassword: string;
  confirmPassword: string;
};

enum AdminTabEnum {
  users = 'users',
  teams = 'teams'
}

const pageSize = 20;

const UserAdminPage = () => {
  const { t } = useTranslation();
  const { userInfo } = useUserStore();
  const isRoot = userInfo?.username === 'root';

  const [pageNum, setPageNum] = useState(1);
  const [searchKey, setSearchKey] = useState('');
  const [status, setStatus] = useState<`${UserStatusEnum}` | undefined>();
  const [adminTab, setAdminTab] = useState<`${AdminTabEnum}`>(AdminTabEnum.users);
  const [editingUser, setEditingUser] = useState<AdminUserItem>();
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUserItem>();

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
    title: t('user:admin.disable_user_confirm_title'),
    content: t('user:admin.disable_user_confirm_desc')
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
              {t('user:admin.users')}
            </Box>
          </Flex>
          {isRoot && (
            <Button variant={'primary'} onClick={onOpenCreate}>
              {t('user:admin.create_user')}
            </Button>
          )}
        </Flex>

        {!isRoot ? (
          <Box color={'myGray.600'} fontSize={'sm'}>
            {t('common:not_permission')}
          </Box>
        ) : (
          <>
            <FillRowTabs
              list={[
                { label: t('user:admin.users'), value: AdminTabEnum.users },
                { label: t('user:admin.teams'), value: AdminTabEnum.teams }
              ]}
              px={'0.5rem'}
              value={adminTab}
              onChange={(val) => setAdminTab(val)}
            />

            {adminTab === AdminTabEnum.users ? (
              <>
                <Flex alignItems={'center'} gap={3} flexWrap={'wrap'}>
                  <Box w={'260px'}>
                    <SearchInput
                      placeholder={t('user:admin.search_username')}
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
                    {t('user:admin.total', { total })}
                  </Text>
                </Flex>

                <MyBox flex={'1 0 0'} h={0} isLoading={loading}>
                  <TableContainer h={'100%'} overflowY={'auto'} fontSize={'sm'}>
                    <Table>
                      <Thead>
                        <Tr>
                          <Th>{t('user:admin.username')}</Th>
                          <Th>{t('user:admin.status')}</Th>
                          <Th>{t('user:admin.timezone')}</Th>
                          <Th>{t('user:admin.created')}</Th>
                          <Th>{t('user:admin.actions')}</Th>
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
                                    {t('user:admin.edit')}
                                  </Button>
                                  {!isRootUser && (
                                    <Button
                                      size={'sm'}
                                      variant={'whitePrimary'}
                                      onClick={() => setResetPasswordUser(user)}
                                    >
                                      {t('user:admin.reset_password')}
                                    </Button>
                                  )}
                                  {!isRootUser && !isForbidden && (
                                    <Button
                                      size={'sm'}
                                      variant={'dangerFill'}
                                      onClick={() => openConfirm(() => disableUser(user._id))()}
                                    >
                                      {t('user:admin.disable')}
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
                                      {t('user:admin.restore')}
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
                    {t('user:admin.page', { page: pageNum, total: totalPages })}
                  </Text>
                  <Button
                    size={'sm'}
                    variant={'whitePrimary'}
                    isDisabled={pageNum <= 1}
                    onClick={() => setPageNum((prev) => Math.max(1, prev - 1))}
                  >
                    {t('user:admin.prev')}
                  </Button>
                  <Button
                    size={'sm'}
                    variant={'whitePrimary'}
                    isDisabled={pageNum >= totalPages}
                    onClick={() => setPageNum((prev) => Math.min(totalPages, prev + 1))}
                  >
                    {t('user:admin.next')}
                  </Button>
                </Flex>
              </>
            ) : (
              <TeamAdminTab />
            )}
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
      {resetPasswordUser && (
        <ResetUserPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(undefined)}
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
      password: ''
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
    <MyModal title={t('user:admin.create_user_title')} isOpen onClose={onClose} isLoading={loading}>
      <ModalBody>
        <FormControl>
          <Box mb={1} fontSize={'sm'}>
            {t('user:admin.username')}
          </Box>
          <Input {...register('username', { required: true })} />
        </FormControl>
        <FormControl mt={4}>
          <Box mb={1} fontSize={'sm'}>
            {t('user:admin.password')}
          </Box>
          <Input type={'password'} {...register('password', { required: true })} />
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
    <MyModal
      title={t('user:admin.edit_user_title', { username: user.username })}
      isOpen
      onClose={onClose}
      isLoading={loading}
    >
      <ModalBody>
        <FormControl>
          <Box mb={1} fontSize={'sm'}>
            {t('user:admin.timezone')}
          </Box>
          <Input {...register('timezone')} />
        </FormControl>
        <FormControl mt={4}>
          <Box mb={1} fontSize={'sm'}>
            {t('user:admin.status')}
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

function TeamAdminTab() {
  const { t } = useTranslation();
  const [teamPageNum, setTeamPageNum] = useState(1);
  const [teamSearchKey, setTeamSearchKey] = useState('');
  const [userSearchKey, setUserSearchKey] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>();
  const [selectedUserId, setSelectedUserId] = useState<string>();
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamOwnerId, setNewTeamOwnerId] = useState<string>();
  const [refreshVersion, setRefreshVersion] = useState(0);

  const refreshData = () => setRefreshVersion((v) => v + 1);

  const { data: teamListResponse, loading: loadingTeams } = useRequest2(
    () =>
      getAdminTeamList({
        pageNum: teamPageNum,
        pageSize,
        searchKey: teamSearchKey.trim() || undefined
      }),
    {
      manual: false,
      refreshDeps: [teamPageNum, teamSearchKey, refreshVersion]
    }
  );

  const { data: userListResponse, loading: loadingUsers } = useRequest2(
    () =>
      getAdminUserList({
        pageNum: 1,
        pageSize: 100,
        searchKey: userSearchKey.trim() || undefined,
        status: UserStatusEnum.active
      }),
    {
      manual: false,
      refreshDeps: [userSearchKey, refreshVersion]
    }
  );

  const teamList = teamListResponse?.list || [];
  const teamTotal = teamListResponse?.total || 0;
  const teamTotalPages = Math.max(1, Math.ceil(teamTotal / pageSize));

  const teamOptions = useMemo(
    () =>
      teamList.map((team) => ({
        label: team.ownerUsername ? `${team.teamName} (${team.ownerUsername})` : team.teamName,
        value: team.teamId
      })),
    [teamList]
  );

  const userOptions = useMemo(
    () =>
      (userListResponse?.list || []).map((user) => ({
        label: user.username,
        value: user._id
      })),
    [userListResponse?.list]
  );

  const { runAsync: createTeam, loading: creatingTeam } = useRequest2(postAdminCreateTeam, {
    successToast: t('common:create_success'),
    onSuccess: () => {
      setNewTeamName('');
      refreshData();
    }
  });

  const { runAsync: bindTeam, loading: bindingTeam } = useRequest2(postAdminBindUserTeam, {
    successToast: t('common:update_success'),
    onSuccess: () => {
      setSelectedTeamId(undefined);
      setSelectedUserId(undefined);
      refreshData();
    }
  });

  const { runAsync: unbindTeam, loading: unbindingTeam } = useRequest2(delAdminUnbindUserTeam, {
    successToast: t('common:update_success'),
    onSuccess: () => {
      setSelectedTeamId(undefined);
      setSelectedUserId(undefined);
      refreshData();
    }
  });

  const { runAsync: deleteTeam, loading: deletingTeam } = useRequest2(delAdminDeleteTeam, {
    successToast: t('common:update_success'),
    onSuccess: () => refreshData()
  });

  const { ConfirmModal: ConfirmDeleteModal, openConfirm: openConfirmDelete } = useConfirm({
    type: 'delete',
    title: t('user:admin.delete_team_confirm_title'),
    content: t('user:admin.delete_team_confirm_desc')
  });
  const { ConfirmModal: ConfirmUnbindModal, openConfirm: openConfirmUnbind } = useConfirm({
    type: 'delete',
    title: t('user:admin.unbind_user_confirm_title'),
    content: t('user:admin.unbind_user_confirm_desc')
  });

  return (
    <>
      <Flex alignItems={'center'} gap={3} flexWrap={'wrap'}>
        <Box w={'260px'}>
          <SearchInput
            placeholder={t('user:admin.search_team')}
            value={teamSearchKey}
            onChange={(e) => {
              setTeamPageNum(1);
              setTeamSearchKey(e.target.value);
            }}
          />
        </Box>
        <Box flex={1} />
        <Text fontSize={'sm'} color={'myGray.600'}>
          {t('user:admin.total', { total: teamTotal })}
        </Text>
      </Flex>

      <MyBox flex={'1 0 0'} h={0} isLoading={loadingTeams}>
        <TableContainer h={'100%'} overflowY={'auto'} fontSize={'sm'}>
          <Table>
            <Thead>
              <Tr>
                <Th>{t('user:admin.team')}</Th>
                <Th>{t('user:admin.owner')}</Th>
                <Th>{t('user:admin.active_members')}</Th>
                <Th>{t('user:admin.created')}</Th>
                <Th>{t('user:admin.actions')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {teamList.map((team) => (
                <Tr key={team.teamId} _hover={{ bg: 'myGray.50' }}>
                  <Td>{team.teamName}</Td>
                  <Td>{team.ownerUsername || '-'}</Td>
                  <Td>
                    <Tag colorScheme={team.activeMemberCount > 0 ? 'green' : 'red'}>
                      {team.activeMemberCount}
                    </Tag>
                  </Td>
                  <Td>{format(new Date(team.createTime), 'yyyy-MM-dd HH:mm:ss')}</Td>
                  <Td>
                    <Button
                      size={'sm'}
                      variant={'dangerFill'}
                      isLoading={deletingTeam}
                      onClick={() =>
                        openConfirmDelete(() =>
                          deleteTeam({
                            teamId: team.teamId
                          })
                        )()
                      }
                    >
                      {t('user:admin.delete_team')}
                    </Button>
                  </Td>
                </Tr>
              ))}
              {teamList.length === 0 && (
                <Tr>
                  <Td colSpan={5}>
                    <Text color={'myGray.500'}>{t('user:admin.no_teams')}</Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </TableContainer>
      </MyBox>

      <Flex alignItems={'center'} justifyContent={'flex-end'} gap={3}>
        <Text fontSize={'sm'} color={'myGray.600'}>
          {t('user:admin.page', { page: teamPageNum, total: teamTotalPages })}
        </Text>
        <Button
          size={'sm'}
          variant={'whitePrimary'}
          isDisabled={teamPageNum <= 1}
          onClick={() => setTeamPageNum((prev) => Math.max(1, prev - 1))}
        >
          {t('user:admin.prev')}
        </Button>
        <Button
          size={'sm'}
          variant={'whitePrimary'}
          isDisabled={teamPageNum >= teamTotalPages}
          onClick={() => setTeamPageNum((prev) => Math.min(teamTotalPages, prev + 1))}
        >
          {t('user:admin.next')}
        </Button>
      </Flex>

      <Box mt={6} fontWeight={'500'} mb={2}>
        {t('user:admin.bind_unbind_user')}
      </Box>
      <Flex gap={2} flexWrap={'wrap'}>
        <Box w={'220px'}>
          <SearchInput
            placeholder={t('user:admin.search_user')}
            value={userSearchKey}
            onChange={(e) => setUserSearchKey(e.target.value)}
          />
        </Box>
        <Box w={'260px'}>
          <MySelect
            value={selectedUserId}
            list={userOptions}
            placeholder={t('user:admin.select_user')}
            isDisabled={loadingUsers}
            onChange={(val) => setSelectedUserId(val)}
          />
        </Box>
        <Box w={'320px'}>
          <MySelect
            value={selectedTeamId}
            list={teamOptions}
            placeholder={t('user:admin.select_team')}
            onChange={(val) => setSelectedTeamId(val)}
          />
        </Box>
        <Button
          variant={'whitePrimary'}
          isLoading={bindingTeam}
          isDisabled={!selectedUserId || !selectedTeamId}
          onClick={() =>
            selectedUserId &&
            selectedTeamId &&
            bindTeam({
              userId: selectedUserId,
              teamId: selectedTeamId
            })
          }
        >
          {t('user:admin.bind')}
        </Button>
        <Button
          variant={'dangerFill'}
          isLoading={unbindingTeam}
          isDisabled={!selectedUserId || !selectedTeamId}
          onClick={() =>
            selectedUserId &&
            selectedTeamId &&
            openConfirmUnbind(() =>
              unbindTeam({
                userId: selectedUserId,
                teamId: selectedTeamId
              })
            )()
          }
        >
          {t('user:admin.unbind')}
        </Button>
      </Flex>

      <Box mt={6} fontWeight={'500'} mb={2}>
        {t('user:admin.create_team')}
      </Box>
      <Flex gap={2} flexWrap={'wrap'}>
        <Input
          value={newTeamName}
          maxLength={100}
          placeholder={t('user:admin.new_team_name')}
          onChange={(e) => setNewTeamName(e.target.value)}
        />
        <Box w={'260px'}>
          <MySelect
            value={newTeamOwnerId}
            list={userOptions}
            placeholder={t('user:admin.select_owner')}
            isDisabled={loadingUsers}
            onChange={(val) => setNewTeamOwnerId(val)}
          />
        </Box>
        <Button
          variant={'primary'}
          isLoading={creatingTeam}
          isDisabled={!newTeamName.trim() || !newTeamOwnerId}
          onClick={() =>
            newTeamOwnerId &&
            createTeam({
              ownerUserId: newTeamOwnerId,
              name: newTeamName.trim()
            })
          }
        >
          {t('user:admin.create_team')}
        </Button>
      </Flex>
      <ConfirmDeleteModal />
      <ConfirmUnbindModal />
    </>
  );
}

function ResetUserPasswordModal({ user, onClose }: { user: AdminUserItem; onClose: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { register, handleSubmit, getValues } = useForm<ResetPasswordFormType>({
    defaultValues: {
      newPassword: '',
      confirmPassword: ''
    }
  });

  const { runAsync, loading } = useRequest2(postAdminResetPassword, {
    successToast: t('common:update_success'),
    onSuccess: () => {
      onClose();
    }
  });

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

  return (
    <MyModal
      title={t('user:admin.reset_password_title', { username: user.username })}
      isOpen
      onClose={onClose}
      isLoading={loading}
    >
      <ModalBody>
        <FormControl>
          <Box mb={1} fontSize={'sm'}>
            {t('user:admin.new_password')}
          </Box>
          <Input
            type={'password'}
            placeholder={t('login:password_tip')}
            {...register('newPassword', {
              required: true,
              validate: (val) => {
                if (!checkPasswordRule(val)) {
                  return t('login:password_tip');
                }
                return true;
              }
            })}
          />
        </FormControl>
        <FormControl mt={4}>
          <Box mb={1} fontSize={'sm'}>
            Confirm Password
          </Box>
          <Input
            type={'password'}
            placeholder={t('user:password.confirm')}
            {...register('confirmPassword', {
              required: true,
              validate: (val) =>
                getValues('newPassword') === val ? true : t('user:password.not_match')
            })}
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
          onClick={handleSubmit(
            (data) =>
              runAsync({
                userId: user._id,
                newPassword: data.newPassword
              }),
            onSubmitErr
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
