import type { AccountCommand, AccountReply } from '../main/account-types.cjs';

declare global {
  interface Window {
    localAccounts: { request(command: AccountCommand): Promise<AccountReply> };
  }
}
