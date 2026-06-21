"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DepositModal } from "@/components/account/deposit-modal";
import { WithdrawModal } from "@/components/account/withdraw-modal";
import { useAccount } from "@/hooks/use-account";
import type { TradingMode } from "@/lib/account/api";

type FundingHandlers = {
  onDepositSuccess?: (amount: number, gateway: string) => void;
  onWithdrawSuccess?: (amount: number) => void;
};

type AppAccountContextValue = ReturnType<typeof useAccount> & {
  openDeposit: () => void;
  openWithdraw: () => void;
  registerFundingHandlers: (handlers: FundingHandlers) => void;
};

const AppAccountContext = createContext<AppAccountContextValue | null>(null);

export function AppAccountProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const handlersRef = useRef<FundingHandlers>({});

  const registerFundingHandlers = useCallback((handlers: FundingHandlers) => {
    handlersRef.current = handlers;
  }, []);

  const openDeposit = useCallback(() => setDepositOpen(true), []);
  const openWithdraw = useCallback(() => setWithdrawOpen(true), []);

  const value = useMemo(
    () => ({
      ...account,
      openDeposit,
      openWithdraw,
      registerFundingHandlers,
    }),
    [account, openDeposit, openWithdraw, registerFundingHandlers],
  );

  return (
    <AppAccountContext.Provider value={value}>
      {children}
      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        mode={account.tradingMode}
        accountId={account.accountId}
        currentBalance={account.balance?.wallet_available ?? 0}
        onSuccess={(amount, gateway) => {
          void account.refresh().then(() => {
            handlersRef.current.onDepositSuccess?.(amount, gateway);
          });
          setDepositOpen(false);
        }}
      />
      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        mode={account.tradingMode}
        walletAvailable={account.balance?.wallet_available ?? 0}
        onSuccess={(amount) => {
          void account.refresh().then(() => {
            handlersRef.current.onWithdrawSuccess?.(amount);
          });
          setWithdrawOpen(false);
        }}
      />
    </AppAccountContext.Provider>
  );
}

export function useAppAccount(): AppAccountContextValue {
  const ctx = useContext(AppAccountContext);
  if (!ctx) {
    throw new Error("useAppAccount must be used within AppAccountProvider");
  }
  return ctx;
}

export type { TradingMode };
